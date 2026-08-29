import { createToken } from '@aeon/di';

export const GreetingService = createToken('GreetingService');

export function createGreetingService() {
  let count = 0;
  return {
    greet(name) {
      count++;
      return `Hello, ${name}! (greeted ${count} time${count === 1 ? '' : 's'})`;
    },
  };
}
