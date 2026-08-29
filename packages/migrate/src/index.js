// Aeon migrate — a best-effort codemod, not a promise of magic.
//
// Scope, on purpose: React function components using only `useState` and
// plain JSX (DOM tags, className/onXxx/plain attributes, text/expression/
// ternary/&&/nested-element children). Anything outside that — useEffect,
// useRef, useContext, custom hooks, class components, fragments, spread
// props, list rendering via .map(), props usage, other component
// references inside JSX — is left completely untouched in the output and
// reported, never guessed at. That's the "no breakage" guarantee: every
// line this tool doesn't understand is byte-for-byte identical to your
// original source, not a best-guess translation.
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
import * as t from '@babel/types';

const generate = generateModule.default || generateModule;

export const MARKER = '@aeon-migrate';

class Unsupported extends Error {}

export function migrate(source) {
  if (!source.includes(MARKER)) {
    return { marker: false, components: [], output: null };
  }

  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const body = ast.program.body;
  const report = [];
  const outputParts = [];
  let anyConverted = false;

  for (const stmt of body) {
    const candidate = extractCandidate(stmt);
    if (!candidate) {
      outputParts.push(sliceSource(source, stmt));
      continue;
    }
    try {
      const converted = convertComponent(candidate);
      report.push({ name: candidate.name, status: 'converted' });
      outputParts.push(renderComponent(candidate, converted));
      anyConverted = true;
    } catch (err) {
      if (!(err instanceof Unsupported)) throw err;
      report.push({ name: candidate.name, status: 'unsupported', reason: err.message });
      outputParts.push(
        `// AEON-MIGRATE: skipped "${candidate.name}" — ${err.message}\n` + sliceSource(source, stmt)
      );
    }
  }

  if (!anyConverted) return { marker: true, components: report, output: null };

  const header = "import { signal, html } from '@aeon-framework/core';\n";
  return { marker: true, components: report, output: header + '\n' + outputParts.join('\n\n') + '\n' };
}

function sliceSource(source, node) {
  return source.slice(node.start, node.end);
}

// ---- finding component candidates -----------------------------------------

function isCapitalized(name) {
  return /^[A-Z]/.test(name);
}

function extractCandidate(stmt) {
  let exportKind = 'none';
  let inner = stmt;
  if (t.isExportDefaultDeclaration(stmt)) {
    exportKind = 'default';
    inner = stmt.declaration;
  } else if (t.isExportNamedDeclaration(stmt) && stmt.declaration) {
    exportKind = 'named';
    inner = stmt.declaration;
  }

  if (t.isFunctionDeclaration(inner) && inner.id && isCapitalized(inner.id.name)) {
    return { name: inner.id.name, exportKind, fn: inner, kind: 'function' };
  }

  if (t.isVariableDeclaration(inner) && inner.declarations.length === 1) {
    const decl = inner.declarations[0];
    if (
      t.isIdentifier(decl.id) &&
      isCapitalized(decl.id.name) &&
      (t.isArrowFunctionExpression(decl.init) || t.isFunctionExpression(decl.init))
    ) {
      return { name: decl.id.name, exportKind, fn: decl.init, kind: 'const', varKind: inner.kind };
    }
  }

  return null;
}

// ---- converting one component ----------------------------------------------

function convertComponent(candidate) {
  const fn = candidate.fn;
  if (fn.params.length > 0) {
    const paramNames = collectParamNames(fn.params[0]);
    if (paramNames.some((n) => identifierUsed(fn.body, n))) {
      throw new Unsupported('reads props — not supported in this version');
    }
  }

  const stateVars = new Map(); // name -> { setter, initNode }
  const handlers = []; // { name, fnNode }
  let returnArg = null;

  const stmts = t.isBlockStatement(fn.body) ? fn.body.body : [{ type: 'ReturnStatement', argument: fn.body, synthetic: true }];

  for (const stmt of stmts) {
    if (t.isVariableDeclaration(stmt) && stmt.declarations.length === 1) {
      const d = stmt.declarations[0];
      if (
        t.isArrayPattern(d.id) &&
        d.id.elements.length === 2 &&
        t.isIdentifier(d.id.elements[0]) &&
        t.isIdentifier(d.id.elements[1]) &&
        t.isCallExpression(d.init) &&
        t.isIdentifier(d.init.callee, { name: 'useState' })
      ) {
        stateVars.set(d.id.elements[0].name, {
          setter: d.id.elements[1].name,
          initNode: d.init.arguments[0] || t.identifier('undefined'),
        });
        continue;
      }
      if (t.isIdentifier(d.id) && (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))) {
        handlers.push({ name: d.id.name, fnNode: d.init });
        continue;
      }
      throw new Unsupported(`unsupported local declaration (${summarize(stmt)})`);
    }
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      handlers.push({ name: stmt.id.name, fnNode: stmt });
      continue;
    }
    if (t.isReturnStatement(stmt)) {
      returnArg = unwrapParens(stmt.argument);
      continue;
    }
    if (stmt.synthetic) {
      returnArg = unwrapParens(stmt.argument);
      continue;
    }
    if (t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression)) {
      const callee = stmt.expression.callee;
      if (t.isIdentifier(callee) && /^use[A-Z]/.test(callee.name)) {
        throw new Unsupported(`uses ${callee.name}() — only useState is supported`);
      }
    }
    throw new Unsupported(`unsupported statement in component body (${summarize(stmt)})`);
  }

  if (!returnArg) throw new Unsupported('no JSX return found');
  if (!t.isJSXElement(returnArg)) {
    throw new Unsupported(
      t.isJSXFragment(returnArg) ? 'returns a fragment (<>...</>) — not supported' : 'return value is not a single JSX element'
    );
  }

  const stateNames = new Set(stateVars.keys());
  const setterNames = new Map([...stateVars].map(([name, v]) => [v.setter, name]));
  const handlerNames = new Set(handlers.map((h) => h.name));

  const templateCode = convertJSXElement(returnArg, stateNames, handlerNames, setterNames);

  const handlerCode = handlers.map((h) => {
    const rewritten = rewriteHandlerBody(h.fnNode.body, stateNames, setterNames);
    const params = h.fnNode.params.map((p) => generate(p).code).join(', ');
    const bodyCode = t.isBlockStatement(rewritten) ? generate(rewritten).code : `{ return ${generate(rewritten).code}; }`;
    return `  const ${h.name} = (${params}) => ${bodyCode};`;
  });

  const signalCode = [...stateVars].map(
    ([name, v]) => `  const ${name} = signal(${generate(v.initNode).code});`
  );

  return { signalCode, handlerCode, templateCode };
}

function collectParamNames(param) {
  if (t.isIdentifier(param)) return [param.name];
  if (t.isObjectPattern(param)) {
    return param.properties.filter((p) => t.isObjectProperty(p) && t.isIdentifier(p.value)).map((p) => p.value.name);
  }
  return [];
}

function identifierUsed(node, name) {
  let found = false;
  (function walk(n) {
    if (found || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === 'Identifier' && n.name === name) {
      found = true;
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
      walk(n[key]);
    }
  })(node);
  return found;
}

function unwrapParens(node) {
  return node;
}

function summarize(stmt) {
  return stmt.type;
}

// ---- expression substitution (state var -> .value) -------------------------

function substituteExpr(node, stateNames) {
  if (node == null) return node;
  switch (node.type) {
    case 'Identifier':
      return stateNames.has(node.name) ? t.memberExpression(t.identifier(node.name), t.identifier('value')) : node;
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
      return node;
    case 'MemberExpression':
      return t.memberExpression(
        substituteExpr(node.object, stateNames),
        node.computed ? substituteExpr(node.property, stateNames) : node.property,
        node.computed
      );
    case 'BinaryExpression':
      return t.binaryExpression(node.operator, substituteExpr(node.left, stateNames), substituteExpr(node.right, stateNames));
    case 'LogicalExpression':
      return t.logicalExpression(node.operator, substituteExpr(node.left, stateNames), substituteExpr(node.right, stateNames));
    case 'UnaryExpression':
      return t.unaryExpression(node.operator, substituteExpr(node.argument, stateNames), node.prefix);
    case 'ConditionalExpression':
      return t.conditionalExpression(
        substituteExpr(node.test, stateNames),
        substituteExpr(node.consequent, stateNames),
        substituteExpr(node.alternate, stateNames)
      );
    case 'CallExpression':
      return t.callExpression(
        substituteExpr(node.callee, stateNames),
        node.arguments.map((a) => substituteExpr(a, stateNames))
      );
    case 'TemplateLiteral':
      return t.templateLiteral(node.quasis, node.expressions.map((e) => substituteExpr(e, stateNames)));
    case 'ArrayExpression':
      return t.arrayExpression(node.elements.map((e) => (e ? substituteExpr(e, stateNames) : e)));
    case 'ParenthesizedExpression':
      return substituteExpr(node.expression, stateNames);
    default:
      throw new Unsupported(`unsupported expression (${node.type}) — needs manual review`);
  }
}

// ---- JSX -> Aeon html`` template --------------------------------------------

const ATTR_RENAMES = { className: 'class', htmlFor: 'for' };

function eventAttrName(reactName) {
  // onClick -> click, onMouseEnter -> mouseenter
  return reactName.slice(2).toLowerCase();
}

function convertJSXElement(node, stateNames, handlerNames, setterNames) {
  if (!t.isJSXElement(node)) return convertJSXChild(node, stateNames, handlerNames, setterNames);
  const opening = node.openingElement;
  const tagName = opening.name.name;
  if (!/^[a-z]/.test(tagName)) {
    throw new Unsupported(`renders <${tagName}> — references to other components aren't supported in this version`);
  }

  const attrs = opening.attributes.map((attr) => {
    if (t.isJSXSpreadAttribute(attr)) throw new Unsupported('uses {...spread} props — not supported');
    const rawName = attr.name.name;
    if (/^on[A-Z]/.test(rawName)) {
      const value = attr.value && t.isJSXExpressionContainer(attr.value) ? attr.value.expression : null;
      if (!value) throw new Unsupported(`event handler ${rawName} must be an expression`);
      return `@${eventAttrName(rawName)}=\${${generate(rewriteHandlerRef(value, stateNames, setterNames, handlerNames)).code}}`;
    }
    const name = ATTR_RENAMES[rawName] || rawName;
    if (!attr.value) return name; // boolean attribute shorthand
    if (t.isStringLiteral(attr.value)) return `${name}="${attr.value.value}"`;
    if (t.isJSXExpressionContainer(attr.value)) {
      const exprUsesState = usesAny(attr.value.expression, stateNames);
      const substituted = substituteExpr(attr.value.expression, stateNames);
      const code = generate(substituted).code;
      return exprUsesState ? `${name}=\${() => ${code}}` : `${name}=\${${code}}`;
    }
    throw new Unsupported(`unsupported attribute value on ${name}`);
  });

  const openTag = attrs.length ? `<${tagName} ${attrs.join(' ')}>` : `<${tagName}>`;
  const isVoid = ['img', 'input', 'br', 'hr', 'meta', 'link'].includes(tagName);
  const children = node.children.map((c) => convertJSXChild(c, stateNames, handlerNames, setterNames)).join('');
  return isVoid ? openTag.replace('>', ' />') : `${openTag}${children}</${tagName}>`;
}

function usesAny(node, names) {
  let found = false;
  (function walk(n) {
    if (found || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === 'Identifier' && names.has(n.name)) {
      found = true;
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
      walk(n[key]);
    }
  })(node);
  return found;
}

function convertJSXChild(node, stateNames, handlerNames, setterNames) {
  if (t.isJSXText(node)) return node.value;
  if (t.isJSXElement(node)) return convertJSXElement(node, stateNames, handlerNames, setterNames);
  if (t.isJSXFragment(node)) throw new Unsupported('uses a fragment (<>...</>) as a child — not supported');
  if (t.isJSXExpressionContainer(node)) {
    const expr = node.expression;
    if (t.isJSXEmptyExpression(expr)) return '';
    if (isMapCall(expr)) {
      throw new Unsupported('renders a list via .map() — convert to @aeon-framework/core\'s list() helper manually');
    }
    if (t.isConditionalExpression(expr) && (t.isJSXElement(expr.consequent) || t.isJSXElement(expr.alternate) || expr.consequent.type === 'NullLiteral' || expr.alternate.type === 'NullLiteral')) {
      const cons = jsxBranchToCode(expr.consequent, stateNames, handlerNames, setterNames);
      const alt = jsxBranchToCode(expr.alternate, stateNames, handlerNames, setterNames);
      const test = generate(substituteExpr(expr.test, stateNames)).code;
      return `\${() => (${test} ? ${cons} : ${alt})}`;
    }
    if (t.isLogicalExpression(expr, { operator: '&&' }) && t.isJSXElement(expr.right)) {
      const left = generate(substituteExpr(expr.left, stateNames)).code;
      const right = jsxBranchToCode(expr.right, stateNames, handlerNames, setterNames);
      return `\${() => (${left} && ${right})}`;
    }
    const substituted = substituteExpr(expr, stateNames);
    const code = generate(substituted).code;
    return `\${() => (${code})}`;
  }
  return '';
}

function jsxBranchToCode(node, stateNames, handlerNames, setterNames) {
  if (t.isNullLiteral(node) || (t.isIdentifier(node) && node.name === 'undefined')) return 'null';
  if (t.isJSXElement(node)) return 'html`' + convertJSXElement(node, stateNames, handlerNames, setterNames) + '`';
  throw new Unsupported('conditional branch is not a JSX element or null — not supported');
}

function isMapCall(node) {
  return t.isCallExpression(node) && t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property, { name: 'map' });
}

// Handlers passed inline as JSX attribute values: arrow functions get their
// setX(...) calls rewritten; a bare identifier referencing a hoisted
// `const handleClick = ...` just gets renamed straight through.
function rewriteHandlerRef(node, stateNames, setterNames, handlerNames) {
  if (t.isIdentifier(node) && handlerNames.has(node.name)) return node;
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
    return { ...node, body: rewriteHandlerBody(node.body, stateNames, setterNames) };
  }
  throw new Unsupported('event handler must be an inline function or a locally declared one');
}

function rewriteHandlerBody(node, stateNames, setterNames) {
  if (t.isBlockStatement(node)) {
    return t.blockStatement(node.body.map((s) => rewriteHandlerStmt(s, stateNames, setterNames)));
  }
  return rewriteSetterCalls(node, stateNames, setterNames);
}

function rewriteHandlerStmt(stmt, stateNames, setterNames) {
  if (t.isExpressionStatement(stmt)) {
    return t.expressionStatement(rewriteSetterCalls(stmt.expression, stateNames, setterNames));
  }
  if (t.isReturnStatement(stmt)) {
    return t.returnStatement(stmt.argument ? rewriteSetterCalls(stmt.argument, stateNames, setterNames) : null);
  }
  if (t.isIfStatement(stmt)) {
    return t.ifStatement(
      substituteExpr(stmt.test, stateNames),
      rewriteHandlerBody(stmt.consequent, stateNames, setterNames),
      stmt.alternate ? rewriteHandlerBody(stmt.alternate, stateNames, setterNames) : null
    );
  }
  throw new Unsupported(`unsupported statement inside an event handler (${stmt.type})`);
}

// setCount(5) -> count.value = 5
// setCount(c => c + 1) -> count.value = c + 1, with `c` treated as count.value
function rewriteSetterCalls(node, stateNames, setterNames) {
  if (t.isCallExpression(node) && t.isIdentifier(node.callee) && setterNames.has(node.callee.name)) {
    const stateName = setterNames.get(node.callee.name);
    const arg = node.arguments[0];
    if (t.isArrowFunctionExpression(arg) && t.isIdentifier(arg.params[0])) {
      const paramName = arg.params[0].name;
      const bodyExpr = t.isBlockStatement(arg.body) ? null : arg.body;
      if (!bodyExpr) throw new Unsupported('functional setState updater with a block body is not supported');
      const renamed = renameIdentifier(bodyExpr, paramName, stateName);
      const value = substituteExpr(renamed, stateNames);
      return t.assignmentExpression('=', t.memberExpression(t.identifier(stateName), t.identifier('value')), value);
    }
    const value = substituteExpr(arg, stateNames);
    return t.assignmentExpression('=', t.memberExpression(t.identifier(stateName), t.identifier('value')), value);
  }
  if (t.isSequenceExpression(node)) {
    return t.sequenceExpression(node.expressions.map((e) => rewriteSetterCalls(e, stateNames, setterNames)));
  }
  return substituteExpr(node, stateNames);
}

function renameIdentifier(node, from, to) {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map((n) => renameIdentifier(n, from, to));
  if (node.type === 'Identifier' && node.name === from) return t.identifier(to);
  const clone = { ...node };
  for (const key of Object.keys(clone)) {
    if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
    clone[key] = renameIdentifier(clone[key], from, to);
  }
  return clone;
}

// ---- emitting the converted component --------------------------------------

function renderComponent(candidate, converted) {
  const { signalCode, handlerCode, templateCode } = converted;
  const paramsCode = candidate.fn.params.length ? '(props)' : '()';
  const lines = [...signalCode, '', ...handlerCode, '', '  return html`' + templateCode + '`;'].filter((l) => l !== '' || true);
  const body = lines.join('\n');

  let decl;
  if (candidate.kind === 'function') {
    decl = `function ${candidate.name}${paramsCode} {\n${body}\n}`;
  } else {
    decl = `const ${candidate.name} = ${paramsCode} => {\n${body}\n};`;
  }

  if (candidate.exportKind === 'default') return `export default ${decl}`;
  if (candidate.exportKind === 'named') return `export ${decl}`;
  return decl;
}
