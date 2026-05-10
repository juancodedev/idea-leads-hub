declare namespace jest {
  type Mocked<T> = {
    [P in keyof T]: T[P] extends (...args: any[]) => any
      ? jest.MockInstance<ReturnType<T[P]>, Parameters<T[P]>>
      : T[P];
  } & T;

  interface MockInstance<T, Y extends any[]> {
    mockResolvedValue(value: T): MockInstance<T, Y>;
    mockRejectedValue(value: any): MockInstance<T, Y>;
    mockImplementation(fn: (...args: Y) => T): MockInstance<T, Y>;
    mockReturnValue(value: T): MockInstance<T, Y>;
    toHaveBeenCalledWith(...args: Y): void;
    // Agrega más si es necesario
  }

  function fn<T = any, Y extends any[] = any[]>(): MockInstance<T, Y>;
}

declare const jest: {
  fn: typeof jest.fn;
  // Agrega más si es necesario
};
