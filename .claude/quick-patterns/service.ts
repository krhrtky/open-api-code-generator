// Vibe Service Pattern with Fluent Interface
// 使用例: const result = await UserService.create(deps).findById(id).activate().execute();

export class ${ServiceName}Service {
  private operations: Operation[] = [];
  
  private constructor(
    private readonly dependencies: ${ServiceName}Dependencies
  ) {}

  // Factory method
  static create(dependencies: ${ServiceName}Dependencies): ${ServiceName}Service {
    return new ${ServiceName}Service(dependencies);
  }

  // Fluent interface methods
  findById(id: string): ${ServiceName}Service {
    this.operations.push({
      type: 'findById',
      payload: { id }
    });
    return this;
  }

  withFilter(filter: FilterType): ${ServiceName}Service {
    this.operations.push({
      type: 'filter',
      payload: { filter }
    });
    return this;
  }

  transform(transformer: TransformerType): ${ServiceName}Service {
    this.operations.push({
      type: 'transform',
      payload: { transformer }
    });
    return this;
  }

  // Terminal operations
  async execute<T>(): Promise<Result<T, ServiceError>> {
    try {
      let result: any = null;

      for (const operation of this.operations) {
        result = await this.executeOperation(operation, result);
      }

      return Result.ok(result);
    } catch (error) {
      return Result.err(new ServiceError(error.message));
    } finally {
      this.operations = []; // Reset for next use
    }
  }

  async toList<T>(): Promise<Result<T[], ServiceError>> {
    const result = await this.execute<T[]>();
    return result.map(data => Array.isArray(data) ? data : [data]);
  }

  async first<T>(): Promise<Result<T | null, ServiceError>> {
    const result = await this.execute<T[]>();
    return result.map(data => {
      if (Array.isArray(data)) {
        return data.length > 0 ? data[0] : null;
      }
      return data;
    });
  }

  async count(): Promise<Result<number, ServiceError>> {
    const result = await this.execute<any[]>();
    return result.map(data => Array.isArray(data) ? data.length : 1);
  }

  // Private execution logic
  private async executeOperation(operation: Operation, previousResult: any): Promise<any> {
    switch (operation.type) {
      case 'findById':
        return await this.dependencies.repository.findById(operation.payload.id);
      
      case 'filter':
        if (!Array.isArray(previousResult)) {
          throw new Error('Filter operation requires array input');
        }
        return previousResult.filter(operation.payload.filter);
      
      case 'transform':
        if (Array.isArray(previousResult)) {
          return previousResult.map(operation.payload.transformer);
        }
        return operation.payload.transformer(previousResult);
      
      default:
        throw new Error(`Unknown operation: ${operation.type}`);
    }
  }
}

// Alternative: Static method approach for simple operations
export class ${ServiceName}Operations {
  static async findById(
    id: string,
    dependencies: ${ServiceName}Dependencies
  ): Promise<Result<EntityType, ServiceError>> {
    try {
      const entity = await dependencies.repository.findById(id);
      if (!entity) {
        return Result.err(new ServiceError('Entity not found'));
      }
      return Result.ok(entity);
    } catch (error) {
      return Result.err(new ServiceError(error.message));
    }
  }

  static async create(
    data: CreateEntityData,
    dependencies: ${ServiceName}Dependencies
  ): Promise<Result<EntityType, ServiceError>> {
    try {
      // Validation
      const validationResult = await ${ServiceName}Validator.validate(data);
      if (validationResult.isErr()) {
        return validationResult.mapError(error => new ServiceError(error.message));
      }

      // Business logic
      const entity = EntityType.create(data);
      
      // Persistence
      await dependencies.repository.save(entity);
      
      return Result.ok(entity);
    } catch (error) {
      return Result.err(new ServiceError(error.message));
    }
  }

  static async update(
    id: string,
    updates: UpdateEntityData,
    dependencies: ${ServiceName}Dependencies
  ): Promise<Result<EntityType, ServiceError>> {
    try {
      // Find existing
      const entityResult = await this.findById(id, dependencies);
      if (entityResult.isErr()) {
        return entityResult;
      }

      const entity = entityResult.unwrap();
      
      // Apply updates
      const updatedEntity = entity.applyUpdates(updates);
      
      // Save
      await dependencies.repository.save(updatedEntity);
      
      return Result.ok(updatedEntity);
    } catch (error) {
      return Result.err(new ServiceError(error.message));
    }
  }
}

// Query builder for complex scenarios
export class ${ServiceName}Query {
  private conditions: QueryCondition[] = [];
  private sortOptions: SortOption[] = [];
  private paginationOptions?: PaginationOption;

  constructor(private dependencies: ${ServiceName}Dependencies) {}

  where(field: string, operator: Operator, value: any): ${ServiceName}Query {
    this.conditions.push({ field, operator, value });
    return this;
  }

  sortBy(field: string, direction: 'asc' | 'desc' = 'asc'): ${ServiceName}Query {
    this.sortOptions.push({ field, direction });
    return this;
  }

  paginate(page: number, limit: number): ${ServiceName}Query {
    this.paginationOptions = { page, limit };
    return this;
  }

  async execute(): Promise<Result<QueryResult<EntityType>, ServiceError>> {
    try {
      const querySpec = {
        conditions: this.conditions,
        sort: this.sortOptions,
        pagination: this.paginationOptions
      };

      const result = await this.dependencies.repository.query(querySpec);
      return Result.ok(result);
    } catch (error) {
      return Result.err(new ServiceError(error.message));
    }
  }
}

// Type definitions
interface ${ServiceName}Dependencies {
  repository: RepositoryType;
  validator?: ValidatorType;
  eventBus?: EventBusType;
}

interface Operation {
  type: string;
  payload: any;
}

interface QueryCondition {
  field: string;
  operator: Operator;
  value: any;
}

interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

interface PaginationOption {
  page: number;
  limit: number;
}

interface QueryResult<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}

type FilterType = (item: any) => boolean;
type TransformerType = (item: any) => any;
type Operator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
type EntityType = any; // Replace with actual entity type
type CreateEntityData = any; // Replace with actual create data type
type UpdateEntityData = any; // Replace with actual update data type
type RepositoryType = any; // Replace with actual repository type
type ValidatorType = any; // Replace with actual validator type
type EventBusType = any; // Replace with actual event bus type

class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Result type implementation (if not already available)
class Result<T, E> {
  private constructor(
    private readonly value: T | null,
    private readonly error: E | null
  ) {}

  static ok<T, E>(value: T): Result<T, E> {
    return new Result(value, null);
  }

  static err<T, E>(error: E): Result<T, E> {
    return new Result(null, error);
  }

  isOk(): boolean {
    return this.error === null;
  }

  isErr(): boolean {
    return this.error !== null;
  }

  unwrap(): T {
    if (this.error !== null) {
      throw new Error('Called unwrap on an error result');
    }
    return this.value!;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isOk()) {
      return Result.ok(fn(this.value!));
    }
    return Result.err(this.error!);
  }

  mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (this.isErr()) {
      return Result.err(fn(this.error!));
    }
    return Result.ok(this.value!);
  }
}