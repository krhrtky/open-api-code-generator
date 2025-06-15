/**
 * Conditional validation functionality for Issue #4, Sub-Issue 4.2
 * Implements dynamic validation control based on field conditions
 * Optimized for large schema processing with caching and performance improvements
 */

import { OpenAPISchema } from './types';

/**
 * Performance optimization: Cache for parsed conditions
 */
interface ConditionCache {
  parsedConditions: Map<string, ConditionExpression>;
  evaluationResults: Map<string, boolean>;
  maxCacheSize: number;
}

/**
 * Performance metrics for monitoring
 */
interface PerformanceMetrics {
  conditionEvaluations: number;
  cacheHits: number;
  cacheMisses: number;
  totalEvaluationTime: number;
  averageEvaluationTime: number;
}

/**
 * Supported operators for condition expressions
 */
export enum ConditionOperator {
  EQUALS = '==',
  NOT_EQUALS = '!=',
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL = '<=',
  IN = 'in',
  NOT_IN = 'not_in',
  CONTAINS = 'contains',
  MATCHES = 'matches',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null'
}

/**
 * Condition expression structure
 */
export interface ConditionExpression {
  /** Field name being evaluated */
  field: string;
  /** Operator for comparison */
  operator: ConditionOperator;
  /** Value to compare against (optional for null checks) */
  value?: any;
  /** Logical operator for combining conditions */
  logicalOperator?: 'AND' | 'OR';
  /** Next condition in the chain */
  next?: ConditionExpression;
}

/**
 * Conditional validation rule definition
 */
export interface ConditionalValidationRule {
  /** Unique identifier for the rule */
  id: string;
  /** Human-readable name */
  name: string;
  /** Condition expression that must be true */
  condition: ConditionExpression;
  /** Validation rules to apply when condition is met */
  validations: string[];
  /** Custom error message */
  message?: string;
  /** Priority for rule evaluation order */
  priority?: number;
}

/**
 * Field dependency mapping
 */
export interface FieldDependency {
  /** Source field that affects validation */
  sourceField: string;
  /** Target field that gets validated */
  targetField: string;
  /** Dependency type */
  type: 'REQUIRED' | 'OPTIONAL' | 'FORBIDDEN' | 'CONDITIONAL';
  /** Condition for dependency activation */
  condition?: ConditionExpression;
}

/**
 * Condition expression parser
 */
export class ConditionParser {
  /**
   * Parse a string condition expression into structured format
   * Supports expressions like: "status == 'ACTIVE'", "age >= 18", "role in ['admin', 'user']"
   */
  static parseExpression(expression: string): ConditionExpression {
    // Remove extra whitespace and normalize
    const normalized = expression.trim().replace(/\s+/g, ' ');
    
    // Validate expression is not empty
    if (!normalized || normalized.length === 0) {
      throw new Error('Expression cannot be empty');
    }
    
    // Handle logical operators (AND, OR)
    const logicalMatch = normalized.match(/^(.+?)\s+(AND|OR)\s+(.+)$/i);
    if (logicalMatch) {
      const [, leftExpr, logicalOp, rightExpr] = logicalMatch;
      const leftCondition = this.parseSingleExpression(leftExpr.trim());
      const rightCondition = this.parseExpression(rightExpr.trim());
      
      leftCondition.logicalOperator = logicalOp.toUpperCase() as 'AND' | 'OR';
      leftCondition.next = rightCondition;
      
      return leftCondition;
    }
    
    return this.parseSingleExpression(normalized);
  }

  /**
   * Parse a single condition expression without logical operators
   */
  private static parseSingleExpression(expression: string): ConditionExpression {
    // Validate expression has minimum structure
    if (!/[><=!]|in\s|is\s|contains\s|matches\s/.test(expression)) {
      throw new Error(`Expression must contain an operator: ${expression}`);
    }
    
    // Handle null checks
    if (expression.match(/\s+is\s+null$/i)) {
      const field = expression.replace(/\s+is\s+null$/i, '').trim();
      return {
        field,
        operator: ConditionOperator.IS_NULL
      };
    }
    
    if (expression.match(/\s+is\s+not\s+null$/i)) {
      const field = expression.replace(/\s+is\s+not\s+null$/i, '').trim();
      return {
        field,
        operator: ConditionOperator.IS_NOT_NULL
      };
    }

    // Handle 'in' operator
    const inMatch = expression.match(/^(\w+)\s+(not\s+)?in\s+\[(.+)\]$/i);
    if (inMatch) {
      const [, field, notModifier, valueList] = inMatch;
      const values = valueList.split(',').map(v => this.parseValue(v.trim()));
      
      return {
        field: field.trim(),
        operator: notModifier ? ConditionOperator.NOT_IN : ConditionOperator.IN,
        value: values
      };
    }

    // Handle contains operator
    const containsMatch = expression.match(/^(\w+)\s+contains\s+(.+)$/i);
    if (containsMatch) {
      const [, field, value] = containsMatch;
      return {
        field: field.trim(),
        operator: ConditionOperator.CONTAINS,
        value: this.parseValue(value.trim())
      };
    }

    // Handle matches operator (regex)
    const matchesMatch = expression.match(/^(\w+)\s+matches\s+\/(.+)\/([gimuy]*)$/i);
    if (matchesMatch) {
      const [, field, pattern, flags] = matchesMatch;
      return {
        field: field.trim(),
        operator: ConditionOperator.MATCHES,
        value: { pattern, flags: flags || '' }
      };
    }

    // Handle comparison operators
    const comparisonMatch = expression.match(/^(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (comparisonMatch) {
      const [, field, operator, value] = comparisonMatch;
      
      // Validate that value is provided
      if (!value || value.trim().length === 0) {
        throw new Error(`Missing value in comparison: ${expression}`);
      }
      
      return {
        field: field.trim(),
        operator: operator as ConditionOperator,
        value: this.parseValue(value.trim())
      };
    }

    throw new Error(`Invalid condition expression: ${expression}`);
  }

  /**
   * Parse a value from string to appropriate type
   */
  private static parseValue(valueStr: string): any {
    // Remove quotes for strings
    if ((valueStr.startsWith("'") && valueStr.endsWith("'")) ||
        (valueStr.startsWith('"') && valueStr.endsWith('"'))) {
      return valueStr.slice(1, -1);
    }

    // Parse boolean
    if (valueStr.toLowerCase() === 'true') return true;
    if (valueStr.toLowerCase() === 'false') return false;

    // Parse null
    if (valueStr.toLowerCase() === 'null') return null;

    // Parse number
    if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
      return valueStr.includes('.') ? parseFloat(valueStr) : parseInt(valueStr, 10);
    }

    // Return as string if no other type matches
    return valueStr;
  }

  /**
   * Validate if an expression is syntactically correct
   */
  static validateExpression(expression: string): { valid: boolean; error?: string } {
    try {
      this.parseExpression(expression);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }
}

/**
 * Conditional validation evaluator with performance optimizations
 */
export class ConditionalValidator {
  private rules: ConditionalValidationRule[] = [];
  private dependencies: FieldDependency[] = [];
  private cache: ConditionCache;
  private metrics: PerformanceMetrics;

  constructor(maxCacheSize: number = 1000) {
    this.cache = {
      parsedConditions: new Map(),
      evaluationResults: new Map(),
      maxCacheSize
    };
    this.metrics = {
      conditionEvaluations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalEvaluationTime: 0,
      averageEvaluationTime: 0
    };
  }

  /**
   * Add a conditional validation rule
   */
  addRule(rule: ConditionalValidationRule): void {
    this.rules.push(rule);
    // Sort by priority (higher priority first)
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Add a field dependency
   */
  addDependency(dependency: FieldDependency): void {
    this.dependencies.push(dependency);
  }

  /**
   * Get all rules
   */
  getRules(): ConditionalValidationRule[] {
    return [...this.rules];
  }

  /**
   * Get all dependencies
   */
  getDependencies(): FieldDependency[] {
    return [...this.dependencies];
  }

  /**
   * Evaluate a condition against provided data with caching optimization
   */
  evaluateCondition(condition: ConditionExpression | string, data: Record<string, any>): boolean {
    const startTime = performance.now();

    try {
      // Handle string condition input
      if (typeof condition === 'string') {
        return this.evaluateStringCondition(condition, data);
      }

      const result = this.evaluateSingleCondition(condition, data);
      
      if (condition.next && condition.logicalOperator) {
        const nextResult = this.evaluateCondition(condition.next, data);
        
        if (condition.logicalOperator === 'AND') {
          return result && nextResult;
        } else if (condition.logicalOperator === 'OR') {
          return result || nextResult;
        }
      }
      
      return result;
    } finally {
      const endTime = performance.now();
      this.updateMetrics(endTime - startTime);
    }
  }

  /**
   * Evaluate string condition with caching
   */
  private evaluateStringCondition(conditionStr: string, data: Record<string, any>): boolean {
    // Create cache key
    const cacheKey = this.createCacheKey(conditionStr, data);
    
    // Check evaluation cache first
    if (this.cache.evaluationResults.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.cache.evaluationResults.get(cacheKey)!;
    }

    this.metrics.cacheMisses++;

    // Parse condition (with caching)
    let parsedCondition: ConditionExpression;
    if (this.cache.parsedConditions.has(conditionStr)) {
      parsedCondition = this.cache.parsedConditions.get(conditionStr)!;
    } else {
      parsedCondition = ConditionParser.parseExpression(conditionStr);
      this.cacheParseResult(conditionStr, parsedCondition);
    }

    // Evaluate condition
    const result = this.evaluateCondition(parsedCondition, data);
    
    // Cache result
    this.cacheEvaluationResult(cacheKey, result);
    
    return result;
  }

  /**
   * Create deterministic cache key for condition and data
   */
  private createCacheKey(condition: string, data: Record<string, any>): string {
    // Extract only relevant fields mentioned in the condition
    const relevantFields = this.extractFieldNames(condition);
    const relevantData: Record<string, any> = {};
    
    for (const field of relevantFields) {
      if (field in data) {
        relevantData[field] = data[field];
      }
    }
    
    return `${condition}:${JSON.stringify(relevantData)}`;
  }

  /**
   * Extract field names from condition string
   */
  private extractFieldNames(condition: string): string[] {
    const fieldPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    const fields = new Set<string>();
    let match;
    
    while ((match = fieldPattern.exec(condition)) !== null) {
      const field = match[1];
      // Skip operators and keywords
      if (!['AND', 'OR', 'NOT', 'in', 'contains', 'matches', 'is_null', 'is_not_null', 'true', 'false', 'null'].includes(field)) {
        fields.add(field);
      }
    }
    
    return Array.from(fields);
  }

  /**
   * Cache parsed condition with size management
   */
  private cacheParseResult(condition: string, parsed: ConditionExpression): void {
    if (this.cache.parsedConditions.size >= this.cache.maxCacheSize) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.cache.parsedConditions.keys().next().value;
      this.cache.parsedConditions.delete(firstKey);
    }
    
    this.cache.parsedConditions.set(condition, parsed);
  }

  /**
   * Cache evaluation result with size management
   */
  private cacheEvaluationResult(cacheKey: string, result: boolean): void {
    if (this.cache.evaluationResults.size >= this.cache.maxCacheSize) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.cache.evaluationResults.keys().next().value;
      this.cache.evaluationResults.delete(firstKey);
    }
    
    this.cache.evaluationResults.set(cacheKey, result);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(evaluationTime: number): void {
    this.metrics.conditionEvaluations++;
    this.metrics.totalEvaluationTime += evaluationTime;
    this.metrics.averageEvaluationTime = this.metrics.totalEvaluationTime / this.metrics.conditionEvaluations;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateSingleCondition(condition: ConditionExpression, data: Record<string, any>): boolean {
    const fieldValue = data[condition.field];
    
    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return fieldValue === condition.value;
        
      case ConditionOperator.NOT_EQUALS:
        return fieldValue !== condition.value;
        
      case ConditionOperator.GREATER_THAN:
        return fieldValue > condition.value;
        
      case ConditionOperator.GREATER_THAN_OR_EQUAL:
        return fieldValue >= condition.value;
        
      case ConditionOperator.LESS_THAN:
        return fieldValue < condition.value;
        
      case ConditionOperator.LESS_THAN_OR_EQUAL:
        return fieldValue <= condition.value;
        
      case ConditionOperator.IN:
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        
      case ConditionOperator.NOT_IN:
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        
      case ConditionOperator.CONTAINS:
        if (typeof fieldValue === 'string') {
          return fieldValue.includes(condition.value);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return false;
        
      case ConditionOperator.MATCHES:
        if (typeof fieldValue === 'string' && condition.value?.pattern) {
          const regex = new RegExp(condition.value.pattern, condition.value.flags);
          return regex.test(fieldValue);
        }
        return false;
        
      case ConditionOperator.IS_NULL:
        return fieldValue === null || fieldValue === undefined;
        
      case ConditionOperator.IS_NOT_NULL:
        return fieldValue !== null && fieldValue !== undefined;
        
      default:
        return false;
    }
  }

  /**
   * Get applicable validation rules for given data
   */
  getApplicableRules(data: Record<string, any>): ConditionalValidationRule[] {
    return this.rules.filter(rule => this.evaluateCondition(rule.condition, data));
  }

  /**
   * Get field dependencies for a given field
   */
  getFieldDependencies(fieldName: string): FieldDependency[] {
    return this.dependencies.filter(dep => dep.targetField === fieldName);
  }

  /**
   * Check if a field is required based on current data
   */
  isFieldRequired(fieldName: string, data: Record<string, any>): boolean {
    const dependencies = this.getFieldDependencies(fieldName);
    
    for (const dependency of dependencies) {
      if (dependency.type === 'REQUIRED' && dependency.condition) {
        if (this.evaluateCondition(dependency.condition, data)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if a field is forbidden based on current data
   */
  isFieldForbidden(fieldName: string, data: Record<string, any>): boolean {
    const dependencies = this.getFieldDependencies(fieldName);
    
    for (const dependency of dependencies) {
      if (dependency.type === 'FORBIDDEN' && dependency.condition) {
        if (this.evaluateCondition(dependency.condition, data)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.metrics = {
      conditionEvaluations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalEvaluationTime: 0,
      averageEvaluationTime: 0
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.parsedConditions.clear();
    this.cache.evaluationResults.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { 
    parsedConditionsCount: number;
    evaluationResultsCount: number;
    hitRate: number;
    maxCacheSize: number;
  } {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate = totalRequests > 0 ? this.metrics.cacheHits / totalRequests : 0;

    return {
      parsedConditionsCount: this.cache.parsedConditions.size,
      evaluationResultsCount: this.cache.evaluationResults.size,
      hitRate,
      maxCacheSize: this.cache.maxCacheSize
    };
  }

  /**
   * Optimize cache by pre-loading frequently used conditions
   */
  preloadConditions(conditions: string[]): void {
    for (const condition of conditions) {
      if (!this.cache.parsedConditions.has(condition)) {
        try {
          const parsed = ConditionParser.parseExpression(condition);
          this.cacheParseResult(condition, parsed);
        } catch (error) {
          console.warn(`Failed to preload condition: ${condition}`, error);
        }
      }
    }
  }

  /**
   * Batch evaluate multiple conditions for efficiency
   */
  batchEvaluate(conditions: string[], data: Record<string, any>): Map<string, boolean> {
    const results = new Map<string, boolean>();
    
    // Sort conditions by complexity (simple ones first for short-circuiting)
    const sortedConditions = conditions.sort((a, b) => a.length - b.length);
    
    for (const condition of sortedConditions) {
      try {
        const result = this.evaluateStringCondition(condition, data);
        results.set(condition, result);
      } catch (error) {
        console.warn(`Failed to evaluate condition: ${condition}`, error);
        results.set(condition, false);
      }
    }
    
    return results;
  }
}

/**
 * Built-in conditional validation rules
 */
export class BuiltInConditionalRules {
  /**
   * Emergency contact required for active users
   */
  static readonly EMERGENCY_CONTACT_FOR_ACTIVE: ConditionalValidationRule = {
    id: 'emergency_contact_for_active',
    name: 'Emergency Contact Required for Active Users',
    condition: ConditionParser.parseExpression("status == 'ACTIVE'"),
    validations: ['NotNull'],
    message: 'Emergency contact is required for active users',
    priority: 100
  };

  /**
   * Phone number required for verified users
   */
  static readonly PHONE_FOR_VERIFIED: ConditionalValidationRule = {
    id: 'phone_for_verified',
    name: 'Phone Number Required for Verified Users',
    condition: ConditionParser.parseExpression("verified == true"),
    validations: ['NotNull', 'PhoneNumber'],
    message: 'Phone number is required for verified users',
    priority: 90
  };

  /**
   * Strong password for admin roles
   */
  static readonly STRONG_PASSWORD_FOR_ADMIN: ConditionalValidationRule = {
    id: 'strong_password_for_admin',
    name: 'Strong Password Required for Admin Roles',
    condition: ConditionParser.parseExpression("role in ['admin', 'superadmin']"),
    validations: ['StrongPassword'],
    message: 'Strong password is required for admin roles',
    priority: 95
  };

  /**
   * Age verification for certain services
   */
  static readonly AGE_VERIFICATION: ConditionalValidationRule = {
    id: 'age_verification',
    name: 'Age Verification Required',
    condition: ConditionParser.parseExpression("serviceType in ['financial', 'gambling', 'adult']"),
    validations: ['NotNull', 'Min'],
    message: 'Age verification is required for this service type',
    priority: 85
  };
}

/**
 * Utility functions for conditional validation
 */
export class ConditionalValidationUtils {
  /**
   * Generate Java conditional validation annotation
   */
  static generateConditionalAnnotation(rule: ConditionalValidationRule): string {
    const conditionStr = this.conditionToJavaExpression(rule.condition);
    const validationsStr = rule.validations.map(v => `"${v}"`).join(', ');
    
    return `@ConditionalValidation(
      condition = "${conditionStr}",
      validations = {${validationsStr}},
      message = "${rule.message || 'Conditional validation failed'}"
    )`;
  }

  /**
   * Convert condition expression to Java SpEL expression
   */
  static conditionToJavaExpression(condition: ConditionExpression): string {
    let expr = this.singleConditionToJavaExpression(condition);
    
    if (condition.next && condition.logicalOperator) {
      const nextExpr = this.conditionToJavaExpression(condition.next);
      const operator = condition.logicalOperator === 'AND' ? '&&' : '||';
      expr = `(${expr}) ${operator} (${nextExpr})`;
    }
    
    return expr;
  }

  /**
   * Convert single condition to Java SpEL expression
   */
  private static singleConditionToJavaExpression(condition: ConditionExpression): string {
    const field = condition.field;
    
    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return `${field} == '${condition.value}'`;
        
      case ConditionOperator.NOT_EQUALS:
        return `${field} != '${condition.value}'`;
        
      case ConditionOperator.GREATER_THAN:
        return `${field} > ${condition.value}`;
        
      case ConditionOperator.GREATER_THAN_OR_EQUAL:
        return `${field} >= ${condition.value}`;
        
      case ConditionOperator.LESS_THAN:
        return `${field} < ${condition.value}`;
        
      case ConditionOperator.LESS_THAN_OR_EQUAL:
        return `${field} <= ${condition.value}`;
        
      case ConditionOperator.IN:
        if (Array.isArray(condition.value)) {
          const values = condition.value.map(v => `'${v}'`).join(', ');
          return `{${values}}.contains(${field})`;
        }
        return 'false';
        
      case ConditionOperator.NOT_IN:
        if (Array.isArray(condition.value)) {
          const values = condition.value.map(v => `'${v}'`).join(', ');
          return `!{${values}}.contains(${field})`;
        }
        return 'true';
        
      case ConditionOperator.CONTAINS:
        return `${field} != null && ${field}.contains('${condition.value}')`;
        
      case ConditionOperator.MATCHES:
        if (condition.value?.pattern) {
          return `${field} != null && ${field}.matches('${condition.value.pattern}')`;
        }
        return 'false';
        
      case ConditionOperator.IS_NULL:
        return `${field} == null`;
        
      case ConditionOperator.IS_NOT_NULL:
        return `${field} != null`;
        
      default:
        return 'false';
    }
  }

  /**
   * Generate field dependency annotation
   */
  static generateDependencyAnnotation(dependency: FieldDependency): string {
    if (!dependency.condition) {
      return `@FieldDependency(
        source = "${dependency.sourceField}",
        target = "${dependency.targetField}",
        type = DependencyType.${dependency.type}
      )`;
    }

    const conditionStr = this.conditionToJavaExpression(dependency.condition);
    
    return `@FieldDependency(
      source = "${dependency.sourceField}",
      target = "${dependency.targetField}",
      type = DependencyType.${dependency.type},
      condition = "${conditionStr}"
    )`;
  }
}