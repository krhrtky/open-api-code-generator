# Vibe Coding パターン集

## 概要

vibe coding は直感的で流れるようなコーディングスタイルです。型安全性を保ちながら、開発者の思考の流れを妨げない実装パターンを提供します。

## 基本原則

### 1. 直感的な命名
```typescript
// ❌ 技術的すぎる命名
const userRepositoryImpl = new UserRepositoryImplementation();
const userDataTransferObject = mapUserEntityToDTO(user);

// ✅ 直感的な命名
const users = new UserStore();
const userInfo = user.toInfo();
```

### 2. 流れるようなAPI設計
```typescript
// ❌ 複雑なセットアップ
const validator = new UserValidator();
validator.setRules([...rules]);
validator.setErrorHandler(errorHandler);
const result = validator.validate(userData);

// ✅ 流れるような設計
const result = User.validate(userData)
  .onError(handleError)
  .result;
```

### 3. 最小限の記述で最大限の表現
```typescript
// ❌ 冗長な実装
function processUserData(userData: UserData): Promise<ProcessedUser> {
  return new Promise((resolve, reject) => {
    try {
      const user = validateUserData(userData);
      const processedUser = transformUserData(user);
      resolve(processedUser);
    } catch (error) {
      reject(error);
    }
  });
}

// ✅ 簡潔な実装
const processUser = (userData: UserData) =>
  User.from(userData)
    .validate()
    .transform();
```

## 実践パターン

### Builder パターンの vibe 活用
```typescript
// 複雑なオブジェクト構築を直感的に
class ApiRequest {
  private constructor(private config: RequestConfig) {}

  static get(url: string) {
    return new ApiRequest({ method: 'GET', url });
  }

  static post(url: string) {
    return new ApiRequest({ method: 'POST', url });
  }

  withHeaders(headers: Record<string, string>) {
    return new ApiRequest({ ...this.config, headers });
  }

  withBody(body: any) {
    return new ApiRequest({ ...this.config, body });
  }

  withAuth(token: string) {
    return this.withHeaders({ Authorization: `Bearer ${token}` });
  }

  async send<T>(): Promise<T> {
    const response = await fetch(this.config.url, {
      method: this.config.method,
      headers: this.config.headers,
      body: this.config.body ? JSON.stringify(this.config.body) : undefined,
    });
    return response.json();
  }
}

// 使用例：読みやすく、直感的
const user = await ApiRequest
  .post('/api/users')
  .withAuth(token)
  .withBody({ name: 'John', email: 'john@example.com' })
  .send<User>();
```

### Maybe/Option パターンの vibe 活用
```typescript
class Maybe<T> {
  private constructor(private value: T | null) {}

  static some<T>(value: T): Maybe<T> {
    return new Maybe(value);
  }

  static none<T>(): Maybe<T> {
    return new Maybe<T>(null);
  }

  static from<T>(value: T | null | undefined): Maybe<T> {
    return value != null ? Maybe.some(value) : Maybe.none();
  }

  map<U>(fn: (value: T) => U): Maybe<U> {
    return this.value != null ? Maybe.some(fn(this.value)) : Maybe.none();
  }

  flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    return this.value != null ? fn(this.value) : Maybe.none();
  }

  filter(predicate: (value: T) => boolean): Maybe<T> {
    return this.value != null && predicate(this.value) 
      ? this 
      : Maybe.none();
  }

  or(defaultValue: T): T {
    return this.value ?? defaultValue;
  }

  orElse(fn: () => T): T {
    return this.value ?? fn();
  }

  exists(): boolean {
    return this.value != null;
  }

  when(fn: (value: T) => void): Maybe<T> {
    if (this.value != null) {
      fn(this.value);
    }
    return this;
  }

  // 型安全なアクセス
  get(): T {
    if (this.value == null) {
      throw new Error('Maybe contains no value');
    }
    return this.value;
  }
}

// 使用例：エレガントなnull処理
const processUser = (userId: string) =>
  Maybe.from(findUserById(userId))
    .filter(user => user.isActive)
    .map(user => user.profile)
    .when(profile => console.log(`Processing ${profile.name}`))
    .or(createDefaultProfile());
```

### Result パターンの vibe 活用
```typescript
class Result<T, E = Error> {
  private constructor(
    private value: T | null,
    private error: E | null
  ) {}

  static ok<T, E = Error>(value: T): Result<T, E> {
    return new Result(value, null);
  }

  static err<T, E = Error>(error: E): Result<T, E> {
    return new Result(null, error);
  }

  static from<T>(fn: () => T): Result<T, Error> {
    try {
      return Result.ok(fn());
    } catch (error) {
      return Result.err(error as Error);
    }
  }

  static async fromAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      const value = await fn();
      return Result.ok(value);
    } catch (error) {
      return Result.err(error as Error);
    }
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return this.isOk() ? Result.ok(fn(this.value!)) : Result.err(this.error!);
  }

  mapError<F>(fn: (error: E) => F): Result<T, F> {
    return this.isOk() ? Result.ok(this.value!) : Result.err(fn(this.error!));
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return this.isOk() ? fn(this.value!) : Result.err(this.error!);
  }

  isOk(): boolean {
    return this.value != null;
  }

  isErr(): boolean {
    return this.error != null;
  }

  unwrap(): T {
    if (this.isErr()) {
      throw this.error;
    }
    return this.value!;
  }

  unwrapOr(defaultValue: T): T {
    return this.isOk() ? this.value! : defaultValue;
  }

  match<U>(patterns: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }): U {
    return this.isOk() 
      ? patterns.ok(this.value!) 
      : patterns.err(this.error!);
  }
}

// 使用例：エラーハンドリングが自然
const saveUser = async (userData: UserData) => {
  const result = await Result.fromAsync(() => 
    User.create(userData).save()
  );

  return result
    .map(user => ({ id: user.id, success: true }))
    .mapError(error => ({ message: error.message, success: false }))
    .match({
      ok: success => success,
      err: failure => failure
    });
};
```

### State Machine パターンの vibe 活用
```typescript
class StateMachine<S extends string, E extends string> {
  private currentState: S;
  private transitions: Map<string, S> = new Map();
  private handlers: Map<string, () => void> = new Map();

  constructor(initialState: S) {
    this.currentState = initialState;
  }

  from(state: S) {
    return {
      on: (event: E) => ({
        to: (nextState: S) => {
          const key = `${state}:${event}`;
          this.transitions.set(key, nextState);
          return this;
        }
      })
    };
  }

  when(state: S, handler: () => void) {
    this.handlers.set(state, handler);
    return this;
  }

  trigger(event: E): boolean {
    const key = `${this.currentState}:${event}`;
    const nextState = this.transitions.get(key);
    
    if (nextState) {
      this.currentState = nextState;
      const handler = this.handlers.get(nextState);
      if (handler) {
        handler();
      }
      return true;
    }
    return false;
  }

  is(state: S): boolean {
    return this.currentState === state;
  }

  get state(): S {
    return this.currentState;
  }
}

// 使用例：注文状態管理
type OrderState = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
type OrderEvent = 'pay' | 'ship' | 'deliver' | 'cancel';

const orderFlow = new StateMachine<OrderState, OrderEvent>('pending')
  .from('pending').on('pay').to('paid')
  .from('pending').on('cancel').to('cancelled')
  .from('paid').on('ship').to('shipped')
  .from('paid').on('cancel').to('cancelled')
  .from('shipped').on('deliver').to('delivered')
  .when('paid', () => console.log('Payment confirmed'))
  .when('shipped', () => console.log('Order shipped'))
  .when('delivered', () => console.log('Order delivered'));
```

### Query Builder パターンの vibe 活用
```typescript
class QueryBuilder<T> {
  private filters: Array<(item: T) => boolean> = [];
  private sorters: Array<(a: T, b: T) => number> = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(private data: T[]) {}

  where(predicate: (item: T) => boolean) {
    this.filters.push(predicate);
    return this;
  }

  sortBy<K extends keyof T>(key: K, direction: 'asc' | 'desc' = 'asc') {
    this.sorters.push((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return direction === 'asc' ? comparison : -comparison;
    });
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  offset(count: number) {
    this.offsetValue = count;
    return this;
  }

  execute(): T[] {
    let result = this.data;

    // Apply filters
    for (const filter of this.filters) {
      result = result.filter(filter);
    }

    // Apply sorting
    if (this.sorters.length > 0) {
      result = result.sort((a, b) => {
        for (const sorter of this.sorters) {
          const comparison = sorter(a, b);
          if (comparison !== 0) return comparison;
        }
        return 0;
      });
    }

    // Apply pagination
    if (this.offsetValue) {
      result = result.slice(this.offsetValue);
    }
    if (this.limitValue) {
      result = result.slice(0, this.limitValue);
    }

    return result;
  }

  first(): T | undefined {
    return this.limit(1).execute()[0];
  }

  count(): number {
    return this.execute().length;
  }

  groupBy<K extends keyof T>(key: K): Record<string, T[]> {
    const result = this.execute();
    return result.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }
}

// Array拡張でより自然に
declare global {
  interface Array<T> {
    query(): QueryBuilder<T>;
  }
}

Array.prototype.query = function<T>(this: T[]) {
  return new QueryBuilder(this);
};

// 使用例：SQLライクなクエリ
const activeUsers = users
  .query()
  .where(user => user.isActive)
  .where(user => user.lastLogin > lastMonth)
  .sortBy('name')
  .limit(10)
  .execute();
```

### Event Emitter パターンの vibe 活用
```typescript
class EventBus<T extends Record<string, any>> {
  private listeners: Map<keyof T, Array<(data: any) => void>> = new Map();

  on<K extends keyof T>(event: K, listener: (data: T[K]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return this;
  }

  once<K extends keyof T>(event: K, listener: (data: T[K]) => void) {
    const onceWrapper = (data: T[K]) => {
      listener(data);
      this.off(event, onceWrapper);
    };
    return this.on(event, onceWrapper);
  }

  off<K extends keyof T>(event: K, listener: (data: T[K]) => void) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
    return this;
  }

  emit<K extends keyof T>(event: K, data: T[K]) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data));
    }
    return this;
  }

  pipe<K extends keyof T>(
    fromEvent: K,
    toEvent: K,
    transform?: (data: T[K]) => T[K]
  ) {
    this.on(fromEvent, (data) => {
      const transformedData = transform ? transform(data) : data;
      this.emit(toEvent, transformedData);
    });
    return this;
  }
}

// 使用例：型安全なイベント管理
interface AppEvents {
  'user:login': { userId: string; timestamp: Date };
  'user:logout': { userId: string };
  'order:created': { orderId: string; amount: number };
  'order:paid': { orderId: string };
}

const events = new EventBus<AppEvents>()
  .on('user:login', ({ userId }) => console.log(`User ${userId} logged in`))
  .on('order:created', ({ orderId, amount }) => 
    console.log(`Order ${orderId} created: $${amount}`)
  )
  .pipe('order:created', 'order:paid', (order) => ({ orderId: order.orderId }));
```

## パフォーマンス配慮パターン

### Lazy Evaluation
```typescript
class Lazy<T> {
  private value?: T;
  private computed = false;

  constructor(private computation: () => T) {}

  get(): T {
    if (!this.computed) {
      this.value = this.computation();
      this.computed = true;
    }
    return this.value!;
  }

  static from<T>(computation: () => T): Lazy<T> {
    return new Lazy(computation);
  }

  map<U>(fn: (value: T) => U): Lazy<U> {
    return Lazy.from(() => fn(this.get()));
  }
}

// 使用例：重い計算の遅延実行
const expensiveResult = Lazy.from(() => {
  console.log('Heavy computation...');
  return heavyComputation();
});

// 必要になるまで計算されない
if (condition) {
  console.log(expensiveResult.get()); // ここで初めて計算される
}
```

### Memoization
```typescript
function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map();
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// 使用例：フィボナッチ数列
const fibonacci = memoize((n: number): number => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
});
```

## まとめ

これらのパターンにより：

1. **直感的なコード**: 開発者の思考に沿った自然な記述
2. **型安全性**: TypeScriptの恩恵を最大限活用
3. **可読性**: コードの意図が明確
4. **保守性**: 変更に強い柔軟な設計
5. **開発効率**: 素早い実装と確実な動作