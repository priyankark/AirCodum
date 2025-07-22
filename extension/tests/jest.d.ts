/// <reference types="jest" />

declare global {
  namespace NodeJS {
    interface Global {
      jest: typeof jest;
    }
  }
}

export {};
