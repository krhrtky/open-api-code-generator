// Vibe API Pattern
// 使用例: app.use('/api/users', UserApi.routes(dependencies));

import { Router, Request, Response, NextFunction } from 'express';

// Type-safe request/response handling
interface ApiRequest<T = any> extends Request {
  body: T;
  validatedData?: T;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Request validation
class RequestValidator<T> {
  constructor(private schema: ValidationSchema<T>) {}

  validate(data: any): ValidationResult<T> {
    try {
      const validated = this.schema.parse(data);
      return { isValid: true, data: validated };
    } catch (error) {
      return { 
        isValid: false, 
        errors: this.extractErrors(error) 
      };
    }
  }

  private extractErrors(error: any): string[] {
    // Extract validation errors based on your validation library
    return Array.isArray(error.errors) 
      ? error.errors.map((e: any) => e.message)
      : [error.message];
  }
}

// API Controller base class
abstract class ApiController {
  protected handleSuccess<T>(
    res: Response, 
    data: T, 
    statusCode: number = 200,
    meta?: any
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      ...(meta && { meta })
    };
    res.status(statusCode).json(response);
  }

  protected handleError(
    res: Response, 
    error: string | Error, 
    statusCode: number = 500
  ): void {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : error
    };
    res.status(statusCode).json(response);
  }

  protected async executeAsync<T>(
    res: Response,
    operation: () => Promise<Result<T, Error>>,
    successCode: number = 200
  ): Promise<void> {
    try {
      const result = await operation();
      
      if (result.isOk()) {
        this.handleSuccess(res, result.unwrap(), successCode);
      } else {
        this.handleError(res, result.error, 400);
      }
    } catch (error) {
      this.handleError(res, error as Error, 500);
    }
  }
}

// Feature-specific API controller
class ${FeatureName}Controller extends ApiController {
  constructor(private dependencies: ${FeatureName}Dependencies) {
    super();
  }

  // Create endpoint
  create = async (req: ApiRequest<Create${EntityName}Request>, res: Response): Promise<void> => {
    await this.executeAsync(res, async () => {
      const service = ${FeatureName}Service.create(this.dependencies);
      return await service.create(req.validatedData!);
    }, 201);
  };

  // Get by ID endpoint
  getById = async (req: ApiRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    
    await this.executeAsync(res, async () => {
      const service = ${FeatureName}Service.create(this.dependencies);
      return await service.findById(id);
    });
  };

  // List endpoint with filtering
  list = async (req: ApiRequest<ListQuery>, res: Response): Promise<void> => {
    await this.executeAsync(res, async () => {
      const query = this.buildQuery(req.query);
      const service = ${FeatureName}Service.create(this.dependencies);
      
      const result = await service
        .query()
        .applyFilters(query.filters)
        .applySort(query.sort)
        .applyPagination(query.pagination)
        .execute();
        
      return result.map(data => ({
        items: data.items,
        meta: {
          total: data.total,
          page: query.pagination.page,
          limit: query.pagination.limit
        }
      }));
    });
  };

  // Update endpoint
  update = async (req: ApiRequest<Update${EntityName}Request>, res: Response): Promise<void> => {
    const { id } = req.params;
    
    await this.executeAsync(res, async () => {
      const service = ${FeatureName}Service.create(this.dependencies);
      return await service.update(id, req.validatedData!);
    });
  };

  // Delete endpoint
  delete = async (req: ApiRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    
    await this.executeAsync(res, async () => {
      const service = ${FeatureName}Service.create(this.dependencies);
      return await service.delete(id);
    });
  };

  // Bulk operations
  bulkCreate = async (req: ApiRequest<Create${EntityName}Request[]>, res: Response): Promise<void> => {
    await this.executeAsync(res, async () => {
      const service = ${FeatureName}Service.create(this.dependencies);
      const results = await Promise.allSettled(
        req.validatedData!.map(data => service.create(data))
      );
      
      const successful = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);
        
      const failed = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason);
        
      return Result.ok({
        successful: successful.length,
        failed: failed.length,
        errors: failed
      });
    });
  };

  private buildQuery(queryParams: any): QueryOptions {
    return {
      filters: this.extractFilters(queryParams),
      sort: this.extractSort(queryParams),
      pagination: this.extractPagination(queryParams)
    };
  }

  private extractFilters(params: any): FilterOptions {
    const filters: FilterOptions = {};
    
    // Extract standard filter parameters
    if (params.status) filters.status = params.status;
    if (params.name) filters.name = { like: params.name };
    if (params.created_after) filters.createdAt = { gte: new Date(params.created_after) };
    if (params.created_before) filters.createdAt = { lte: new Date(params.created_before) };
    
    return filters;
  }

  private extractSort(params: any): SortOptions {
    const sortBy = params.sort_by || 'createdAt';
    const sortOrder = params.sort_order || 'desc';
    
    return { [sortBy]: sortOrder };
  }

  private extractPagination(params: any): PaginationOptions {
    return {
      page: Math.max(1, parseInt(params.page) || 1),
      limit: Math.min(100, parseInt(params.limit) || 20)
    };
  }
}

// Middleware for validation
const validateRequest = <T>(validator: RequestValidator<T>) => {
  return (req: ApiRequest<T>, res: Response, next: NextFunction): void => {
    const result = validator.validate(req.body);
    
    if (!result.isValid) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.errors
      });
      return;
    }
    
    req.validatedData = result.data;
    next();
  };
};

// Authentication middleware
const authenticate = (req: ApiRequest, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }
  
  try {
    // Verify token and attach user to request
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// Authorization middleware
const authorize = (permissions: string[]) => {
  return (req: ApiRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }
    
    const hasPermission = permissions.some(permission => 
      user.permissions.includes(permission)
    );
    
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }
    
    next();
  };
};

// Route factory
class ${FeatureName}Routes {
  static create(dependencies: ${FeatureName}Dependencies): Router {
    const router = Router();
    const controller = new ${FeatureName}Controller(dependencies);
    
    // Validation schemas
    const createValidator = new RequestValidator(CREATE_${ENTITY_NAME}_SCHEMA);
    const updateValidator = new RequestValidator(UPDATE_${ENTITY_NAME}_SCHEMA);
    
    // Routes
    router.post(
      '/',
      authenticate,
      authorize(['create_${entity_name}']),
      validateRequest(createValidator),
      controller.create
    );
    
    router.get(
      '/',
      authenticate,
      authorize(['read_${entity_name}']),
      controller.list
    );
    
    router.get(
      '/:id',
      authenticate,
      authorize(['read_${entity_name}']),
      controller.getById
    );
    
    router.put(
      '/:id',
      authenticate,
      authorize(['update_${entity_name}']),
      validateRequest(updateValidator),
      controller.update
    );
    
    router.delete(
      '/:id',
      authenticate,
      authorize(['delete_${entity_name}']),
      controller.delete
    );
    
    // Bulk operations
    router.post(
      '/bulk',
      authenticate,
      authorize(['create_${entity_name}']),
      validateRequest(new RequestValidator(BULK_CREATE_${ENTITY_NAME}_SCHEMA)),
      controller.bulkCreate
    );
    
    return router;
  }
}

// Error handling middleware
const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('API Error:', error);
  
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.message
    });
    return;
  }
  
  if (error.name === 'NotFoundError') {
    res.status(404).json({
      success: false,
      error: 'Resource not found'
    });
    return;
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};

// API composition
export class ${FeatureName}Api {
  static routes(dependencies: ${FeatureName}Dependencies): Router {
    const router = Router();
    
    // Apply common middleware
    router.use(express.json());
    router.use(cors());
    router.use(helmet());
    
    // Feature routes
    router.use('/${feature_name}', ${FeatureName}Routes.create(dependencies));
    
    // Error handling
    router.use(errorHandler);
    
    return router;
  }
}

// OpenAPI documentation
export const ${FeatureName}ApiDocs = {
  openapi: '3.0.0',
  info: {
    title: '${FeatureName} API',
    version: '1.0.0'
  },
  paths: {
    '/${feature_name}': {
      get: {
        summary: 'List ${entity_name}s',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100 }
          }
        ],
        responses: {
          '200': {
            description: 'List of ${entity_name}s',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        items: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/${EntityName}' }
                        },
                        meta: {
                          type: 'object',
                          properties: {
                            total: { type: 'integer' },
                            page: { type: 'integer' },
                            limit: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Create ${entity_name}',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Create${EntityName}Request' }
            }
          }
        },
        responses: {
          '201': {
            description: '${EntityName} created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/${EntityName}' }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      ${EntityName}: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Create${EntityName}Request: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' }
        }
      }
    }
  }
};

// Type definitions
interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors?: string[];
}

interface ValidationSchema<T> {
  parse(data: any): T;
}

interface Create${EntityName}Request {
  name: string;
  description?: string;
}

interface Update${EntityName}Request {
  name?: string;
  description?: string;
}

interface ListQuery {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  [key: string]: any;
}

interface QueryOptions {
  filters: FilterOptions;
  sort: SortOptions;
  pagination: PaginationOptions;
}

interface FilterOptions {
  [key: string]: any;
}

interface SortOptions {
  [key: string]: 'asc' | 'desc';
}

interface PaginationOptions {
  page: number;
  limit: number;
}

interface ${FeatureName}Dependencies {
  repository: any;
  eventBus?: any;
  cache?: any;
}

// Validation schemas (using Zod as example)
const CREATE_${ENTITY_NAME}_SCHEMA = {
  parse: (data: any) => {
    // Implement validation logic
    return data as Create${EntityName}Request;
  }
};

const UPDATE_${ENTITY_NAME}_SCHEMA = {
  parse: (data: any) => {
    // Implement validation logic
    return data as Update${EntityName}Request;
  }
};

const BULK_CREATE_${ENTITY_NAME}_SCHEMA = {
  parse: (data: any) => {
    // Implement validation logic
    return data as Create${EntityName}Request[];
  }
};

// Helper functions
function verifyToken(token: string): any {
  // Implement token verification
  return { id: 'user-id', permissions: ['read_${entity_name}'] };
}

// Express imports (add these to your actual file)
declare const express: any;
declare const cors: any;
declare const helmet: any;