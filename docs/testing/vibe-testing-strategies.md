# Vibe Testing Strategies

## 概要

vibe testing は直感的で自然なテストアプローチです。テストコードも実装コードと同様に、読みやすく、書きやすく、保守しやすいものにします。

## 基本方針

### 1. テストは仕様書
```typescript
// ❌ 技術的すぎるテスト
describe('UserService', () => {
  it('should return true when validateUser is called with valid data', () => {
    // ...
  });
});

// ✅ 仕様を表現するテスト
describe('User Registration', () => {
  it('accepts valid user data', () => {
    // ...
  });

  it('rejects empty email', () => {
    // ...
  });

  it('rejects duplicate email', () => {
    // ...
  });
});
```

### 2. Given-When-Then パターン
```typescript
describe('Shopping Cart', () => {
  it('calculates total price correctly', () => {
    // Given: カートに商品を追加
    const cart = ShoppingCart.empty()
      .addItem({ name: 'Apple', price: 100, quantity: 2 })
      .addItem({ name: 'Banana', price: 50, quantity: 3 });

    // When: 合計金額を計算
    const total = cart.getTotalPrice();

    // Then: 正しい金額が返される
    expect(total).toBe(350);
  });
});
```

### 3. 自然言語に近いアサーション
```typescript
// カスタムマッチャーで自然な表現
expect(user).toBeActive();
expect(order).toBeShipped();
expect(cart).toContain(item);
expect(response).toHaveStatus(200);
expect(list).toHaveLength(3);
```

## テストパターン

### Builder Pattern for Test Data
```typescript
class UserBuilder {
  private userData: Partial<User> = {};

  static create(): UserBuilder {
    return new UserBuilder();
  }

  withName(name: string): UserBuilder {
    this.userData.name = name;
    return this;
  }

  withEmail(email: string): UserBuilder {
    this.userData.email = email;
    return this;
  }

  active(): UserBuilder {
    this.userData.status = 'active';
    return this;
  }

  inactive(): UserBuilder {
    this.userData.status = 'inactive';
    return this;
  }

  build(): User {
    return {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      status: 'active',
      ...this.userData
    };
  }
}

// 使用例：読みやすいテストデータ作成
describe('User Service', () => {
  it('sends welcome email to new active users', () => {
    const user = UserBuilder.create()
      .withName('John Doe')
      .withEmail('john@example.com')
      .active()
      .build();

    userService.register(user);

    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(user.email);
  });
});
```

### Scenario-based Testing
```typescript
class TestScenario {
  private actions: Array<() => void> = [];
  private expectations: Array<() => void> = [];

  when(description: string, action: () => void): TestScenario {
    console.log(`When: ${description}`);
    this.actions.push(action);
    return this;
  }

  then(description: string, expectation: () => void): TestScenario {
    console.log(`Then: ${description}`);
    this.expectations.push(expectation);
    return this;
  }

  async run(): Promise<void> {
    for (const action of this.actions) {
      await action();
    }
    for (const expectation of this.expectations) {
      await expectation();
    }
  }
}

// 使用例：シナリオベーステスト
describe('E-commerce Flow', () => {
  it('completes order successfully', async () => {
    const scenario = new TestScenario()
      .when('user adds item to cart', () => {
        cart.addItem(testItem);
      })
      .when('user proceeds to checkout', () => {
        checkout.proceed(cart);
      })
      .when('user provides payment info', () => {
        checkout.setPayment(testPayment);
      })
      .when('user confirms order', () => {
        checkout.confirm();
      })
      .then('order is created', () => {
        expect(orderService.getLastOrder()).toBeTruthy();
      })
      .then('payment is processed', () => {
        expect(paymentService.getLastTransaction()).toBeTruthy();
      })
      .then('confirmation email is sent', () => {
        expect(emailService.sendConfirmation).toHaveBeenCalled();
      });

    await scenario.run();
  });
});
```

### Property-based Testing
```typescript
// 自然な性質を表現したテスト
describe('String utilities', () => {
  it('reverse of reverse returns original string', () => {
    fc.assert(fc.property(fc.string(), (str) => {
      const reversed = reverse(reverse(str));
      expect(reversed).toBe(str);
    }));
  });

  it('sorted array is always in order', () => {
    fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
      const sorted = sort(arr);
      expect(isSorted(sorted)).toBe(true);
    }));
  });
});
```

### Visual Testing for UI
```typescript
// スナップショットテストの活用
describe('Button Component', () => {
  it('renders correctly in default state', () => {
    const button = render(<Button>Click me</Button>);
    expect(button).toMatchSnapshot();
  });

  it('shows loading state', () => {
    const button = render(<Button loading>Loading...</Button>);
    expect(button).toMatchSnapshot();
  });

  it('handles different sizes', () => {
    ['small', 'medium', 'large'].forEach(size => {
      const button = render(<Button size={size}>Button</Button>);
      expect(button).toMatchSnapshot(`button-${size}`);
    });
  });
});
```

## モックとスタブの vibe 活用

### Behavior Verification
```typescript
class MockTracker {
  private calls: Map<string, any[]> = new Map();

  track(methodName: string, ...args: any[]): void {
    if (!this.calls.has(methodName)) {
      this.calls.set(methodName, []);
    }
    this.calls.get(methodName)!.push(args);
  }

  wasCalledWith(methodName: string, ...expectedArgs: any[]): boolean {
    const calls = this.calls.get(methodName) || [];
    return calls.some(args => 
      JSON.stringify(args) === JSON.stringify(expectedArgs)
    );
  }

  wasCalledTimes(methodName: string, times: number): boolean {
    const calls = this.calls.get(methodName) || [];
    return calls.length === times;
  }

  getCalls(methodName: string): any[][] {
    return this.calls.get(methodName) || [];
  }
}

// 使用例：自然な振る舞い検証
describe('Order Service', () => {
  it('notifies customer when order is shipped', () => {
    const mockNotification = new MockTracker();
    const notificationService = {
      send: (userId: string, message: string) => {
        mockNotification.track('send', userId, message);
      }
    };

    orderService.ship(order, notificationService);

    expect(mockNotification.wasCalledWith(
      'send', 
      order.customerId, 
      'Your order has been shipped!'
    )).toBe(true);
  });
});
```

### Test Doubles with Fluent Interface
```typescript
class ServiceDouble<T> {
  private responses: Map<string, any> = new Map();
  private behaviors: Map<string, Function> = new Map();

  when(methodName: keyof T): {
    returns: (value: any) => ServiceDouble<T>;
    throws: (error: Error) => ServiceDouble<T>;
    calls: (fn: Function) => ServiceDouble<T>;
  } {
    return {
      returns: (value: any) => {
        this.responses.set(methodName as string, value);
        return this;
      },
      throws: (error: Error) => {
        this.behaviors.set(methodName as string, () => { throw error; });
        return this;
      },
      calls: (fn: Function) => {
        this.behaviors.set(methodName as string, fn);
        return this;
      }
    };
  }

  build(): T {
    return new Proxy({} as T, {
      get: (target, prop) => {
        const propName = prop as string;
        
        if (this.behaviors.has(propName)) {
          return this.behaviors.get(propName);
        }
        
        if (this.responses.has(propName)) {
          return () => this.responses.get(propName);
        }
        
        return () => undefined;
      }
    });
  }
}

// 使用例：直感的なモック作成
describe('Payment Processing', () => {
  it('handles payment gateway timeout', () => {
    const paymentGateway = new ServiceDouble<PaymentGateway>()
      .when('processPayment')
      .throws(new Error('Gateway timeout'))
      .build();

    const result = paymentService.processOrder(order, paymentGateway);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('Gateway timeout');
  });
});
```

## 統合テストパターン

### Database Testing
```typescript
class TestDatabase {
  private data: Map<string, any[]> = new Map();

  async seed(tableName: string, records: any[]): Promise<void> {
    this.data.set(tableName, [...records]);
  }

  async clear(tableName: string): Promise<void> {
    this.data.set(tableName, []);
  }

  async find(tableName: string, query: any): Promise<any[]> {
    const records = this.data.get(tableName) || [];
    return records.filter(record => 
      Object.entries(query).every(([key, value]) => record[key] === value)
    );
  }

  async count(tableName: string): Promise<number> {
    return (this.data.get(tableName) || []).length;
  }

  async hasRecord(tableName: string, query: any): Promise<boolean> {
    const records = await this.find(tableName, query);
    return records.length > 0;
  }
}

// 使用例：データベーステスト
describe('User Repository', () => {
  const testDb = new TestDatabase();

  beforeEach(async () => {
    await testDb.clear('users');
  });

  it('saves user correctly', async () => {
    const user = { name: 'John', email: 'john@example.com' };
    
    await userRepository.save(user);
    
    expect(await testDb.hasRecord('users', user)).toBe(true);
  });
});
```

### API Testing
```typescript
class ApiTester {
  constructor(private baseUrl: string) {}

  async get(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`);
    return {
      status: response.status,
      data: await response.json(),
      headers: response.headers
    };
  }

  async post(path: string, body: any) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return {
      status: response.status,
      data: await response.json(),
      headers: response.headers
    };
  }

  expectStatus(response: any, expectedStatus: number) {
    expect(response.status).toBe(expectedStatus);
    return this;
  }

  expectData(response: any, expectedData: any) {
    expect(response.data).toEqual(expectedData);
    return this;
  }

  expectHeader(response: any, headerName: string, expectedValue: string) {
    expect(response.headers.get(headerName)).toBe(expectedValue);
    return this;
  }
}

// 使用例：API統合テスト
describe('User API', () => {
  const api = new ApiTester('http://localhost:3000');

  it('creates user successfully', async () => {
    const userData = { name: 'John', email: 'john@example.com' };
    
    const response = await api.post('/users', userData);
    
    api.expectStatus(response, 201)
       .expectData(response, expect.objectContaining(userData));
  });
});
```

## パフォーマンステスト

### Load Testing
```typescript
class LoadTester {
  async runConcurrent<T>(
    operation: () => Promise<T>,
    concurrency: number,
    duration: number
  ): Promise<LoadTestResult> {
    const results: T[] = [];
    const errors: Error[] = [];
    const startTime = Date.now();

    const workers = Array.from({ length: concurrency }, async () => {
      while (Date.now() - startTime < duration) {
        try {
          const result = await operation();
          results.push(result);
        } catch (error) {
          errors.push(error as Error);
        }
      }
    });

    await Promise.all(workers);

    return {
      totalRequests: results.length + errors.length,
      successfulRequests: results.length,
      failedRequests: errors.length,
      successRate: results.length / (results.length + errors.length),
      duration: Date.now() - startTime,
      requestsPerSecond: results.length / ((Date.now() - startTime) / 1000)
    };
  }
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  duration: number;
  requestsPerSecond: number;
}

// 使用例：負荷テスト
describe('API Performance', () => {
  it('handles concurrent requests', async () => {
    const loadTester = new LoadTester();
    
    const result = await loadTester.runConcurrent(
      () => api.get('/users'),
      10, // 10 concurrent requests
      5000 // for 5 seconds
    );

    expect(result.successRate).toBeGreaterThan(0.95);
    expect(result.requestsPerSecond).toBeGreaterThan(100);
  });
});
```

## エラーハンドリングテスト

### Error Scenarios
```typescript
class ErrorScenario {
  static networkError(): Error {
    return new Error('Network connection failed');
  }

  static timeout(): Error {
    return new Error('Request timeout');
  }

  static unauthorized(): Error {
    return new Error('Unauthorized access');
  }

  static validationError(field: string, message: string): Error {
    const error = new Error(`Validation failed: ${message}`);
    (error as any).field = field;
    return error;
  }
}

// 使用例：エラーケーステスト
describe('Error Handling', () => {
  it('gracefully handles network errors', async () => {
    const mockService = new ServiceDouble<ApiService>()
      .when('fetchData')
      .throws(ErrorScenario.networkError())
      .build();

    const result = await dataProcessor.process(mockService);

    expect(result.status).toBe('error');
    expect(result.message).toContain('Network connection failed');
  });
});
```

## まとめ

vibe testing により：

1. **読みやすいテスト**: 仕様書として機能するテストコード
2. **書きやすいテスト**: 直感的なAPI設計
3. **保守しやすいテスト**: 変更に強いテスト構造
4. **信頼できるテスト**: 確実にバグを検出
5. **効率的なテスト**: 素早い実行と明確な結果