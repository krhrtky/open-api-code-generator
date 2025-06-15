/**
 * Test suite for conditional validation functionality
 * Tests Issue #4, Sub-Issue 4.2: Conditional validation implementation
 */

import {
  ConditionParser,
  ConditionOperator,
  ConditionExpression,
  ConditionalValidator,
  ConditionalValidationRule,
  FieldDependency,
  BuiltInConditionalRules,
  ConditionalValidationUtils
} from '../conditional-validation';

describe('ConditionParser', () => {
  describe('parseExpression', () => {
    test('should parse simple equality condition', () => {
      const result = ConditionParser.parseExpression("status == 'ACTIVE'");
      
      expect(result.field).toBe('status');
      expect(result.operator).toBe(ConditionOperator.EQUALS);
      expect(result.value).toBe('ACTIVE');
      expect(result.logicalOperator).toBeUndefined();
      expect(result.next).toBeUndefined();
    });

    test('should parse numeric comparison conditions', () => {
      const ageCondition = ConditionParser.parseExpression('age >= 18');
      expect(ageCondition.field).toBe('age');
      expect(ageCondition.operator).toBe(ConditionOperator.GREATER_THAN_OR_EQUAL);
      expect(ageCondition.value).toBe(18);

      const scoreCondition = ConditionParser.parseExpression('score < 100.5');
      expect(scoreCondition.field).toBe('score');
      expect(scoreCondition.operator).toBe(ConditionOperator.LESS_THAN);
      expect(scoreCondition.value).toBe(100.5);
    });

    test('should parse in operator conditions', () => {
      const result = ConditionParser.parseExpression("role in ['admin', 'superadmin']");
      
      expect(result.field).toBe('role');
      expect(result.operator).toBe(ConditionOperator.IN);
      expect(result.value).toEqual(['admin', 'superadmin']);
    });

    test('should parse not in operator conditions', () => {
      const result = ConditionParser.parseExpression("status not in ['INACTIVE', 'SUSPENDED']");
      
      expect(result.field).toBe('status');
      expect(result.operator).toBe(ConditionOperator.NOT_IN);
      expect(result.value).toEqual(['INACTIVE', 'SUSPENDED']);
    });

    test('should parse null check conditions', () => {
      const isNullResult = ConditionParser.parseExpression('middleName is null');
      expect(isNullResult.field).toBe('middleName');
      expect(isNullResult.operator).toBe(ConditionOperator.IS_NULL);

      const isNotNullResult = ConditionParser.parseExpression('email is not null');
      expect(isNotNullResult.field).toBe('email');
      expect(isNotNullResult.operator).toBe(ConditionOperator.IS_NOT_NULL);
    });

    test('should parse contains conditions', () => {
      const result = ConditionParser.parseExpression("description contains 'important'");
      
      expect(result.field).toBe('description');
      expect(result.operator).toBe(ConditionOperator.CONTAINS);
      expect(result.value).toBe('important');
    });

    test('should parse regex matches conditions', () => {
      const result = ConditionParser.parseExpression('phoneNumber matches /^\\+1\\d{10}$/i');
      
      expect(result.field).toBe('phoneNumber');
      expect(result.operator).toBe(ConditionOperator.MATCHES);
      expect(result.value).toEqual({ pattern: '^\\+1\\d{10}$', flags: 'i' });
    });

    test('should parse logical AND conditions', () => {
      const result = ConditionParser.parseExpression("status == 'ACTIVE' AND age >= 18");
      
      expect(result.field).toBe('status');
      expect(result.operator).toBe(ConditionOperator.EQUALS);
      expect(result.value).toBe('ACTIVE');
      expect(result.logicalOperator).toBe('AND');
      
      expect(result.next).toBeDefined();
      expect(result.next!.field).toBe('age');
      expect(result.next!.operator).toBe(ConditionOperator.GREATER_THAN_OR_EQUAL);
      expect(result.next!.value).toBe(18);
    });

    test('should parse logical OR conditions', () => {
      const result = ConditionParser.parseExpression("role == 'admin' OR role == 'superadmin'");
      
      expect(result.field).toBe('role');
      expect(result.operator).toBe(ConditionOperator.EQUALS);
      expect(result.value).toBe('admin');
      expect(result.logicalOperator).toBe('OR');
      
      expect(result.next).toBeDefined();
      expect(result.next!.field).toBe('role');
      expect(result.next!.operator).toBe(ConditionOperator.EQUALS);
      expect(result.next!.value).toBe('superadmin');
    });

    test('should parse boolean values correctly', () => {
      const trueResult = ConditionParser.parseExpression('verified == true');
      expect(trueResult.value).toBe(true);

      const falseResult = ConditionParser.parseExpression('verified == false');
      expect(falseResult.value).toBe(false);
    });

    test('should throw error for invalid expressions', () => {
      expect(() => ConditionParser.parseExpression('invalid expression')).toThrow();
      expect(() => ConditionParser.parseExpression('')).toThrow();
      expect(() => ConditionParser.parseExpression('field')).toThrow();
    });
  });

  describe('validateExpression', () => {
    test('should validate correct expressions', () => {
      const validExpressions = [
        "status == 'ACTIVE'",
        'age >= 18',
        "role in ['admin', 'user']",
        'email is not null',
        "status == 'ACTIVE' AND age >= 18"
      ];

      validExpressions.forEach(expr => {
        const result = ConditionParser.validateExpression(expr);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test('should invalidate incorrect expressions', () => {
      const invalidExpressions = [
        '   ',  // empty/whitespace
        'field ==',  // missing value
        'just a field name',  // no operator
        '== value',  // missing field
      ];

      invalidExpressions.forEach(expr => {
        const result = ConditionParser.validateExpression(expr);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });
});

describe('ConditionalValidator', () => {
  let validator: ConditionalValidator;

  beforeEach(() => {
    validator = new ConditionalValidator();
  });

  describe('Rule Management', () => {
    test('should add and retrieve rules', () => {
      const rule: ConditionalValidationRule = {
        id: 'test_rule',
        name: 'Test Rule',
        condition: ConditionParser.parseExpression("status == 'ACTIVE'"),
        validations: ['NotNull'],
        priority: 100
      };

      validator.addRule(rule);
      const rules = validator.getRules();
      
      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual(rule);
    });

    test('should sort rules by priority', () => {
      const lowPriorityRule: ConditionalValidationRule = {
        id: 'low',
        name: 'Low Priority',
        condition: ConditionParser.parseExpression("status == 'ACTIVE'"),
        validations: ['NotNull'],
        priority: 10
      };

      const highPriorityRule: ConditionalValidationRule = {
        id: 'high',
        name: 'High Priority',
        condition: ConditionParser.parseExpression("status == 'ACTIVE'"),
        validations: ['NotNull'],
        priority: 100
      };

      validator.addRule(lowPriorityRule);
      validator.addRule(highPriorityRule);
      
      const rules = validator.getRules();
      expect(rules[0].id).toBe('high');
      expect(rules[1].id).toBe('low');
    });
  });

  describe('Condition Evaluation', () => {
    test('should evaluate simple equality conditions', () => {
      const condition = ConditionParser.parseExpression("status == 'ACTIVE'");
      
      expect(validator.evaluateCondition(condition, { status: 'ACTIVE' })).toBe(true);
      expect(validator.evaluateCondition(condition, { status: 'INACTIVE' })).toBe(false);
    });

    test('should evaluate numeric comparison conditions', () => {
      const condition = ConditionParser.parseExpression('age >= 18');
      
      expect(validator.evaluateCondition(condition, { age: 18 })).toBe(true);
      expect(validator.evaluateCondition(condition, { age: 25 })).toBe(true);
      expect(validator.evaluateCondition(condition, { age: 17 })).toBe(false);
    });

    test('should evaluate in conditions', () => {
      const condition = ConditionParser.parseExpression("role in ['admin', 'superadmin']");
      
      expect(validator.evaluateCondition(condition, { role: 'admin' })).toBe(true);
      expect(validator.evaluateCondition(condition, { role: 'superadmin' })).toBe(true);
      expect(validator.evaluateCondition(condition, { role: 'user' })).toBe(false);
    });

    test('should evaluate null check conditions', () => {
      const isNullCondition = ConditionParser.parseExpression('middleName is null');
      const isNotNullCondition = ConditionParser.parseExpression('email is not null');
      
      expect(validator.evaluateCondition(isNullCondition, { middleName: null })).toBe(true);
      expect(validator.evaluateCondition(isNullCondition, { middleName: 'John' })).toBe(false);
      
      expect(validator.evaluateCondition(isNotNullCondition, { email: 'test@example.com' })).toBe(true);
      expect(validator.evaluateCondition(isNotNullCondition, { email: null })).toBe(false);
    });

    test('should evaluate logical AND conditions', () => {
      const condition = ConditionParser.parseExpression("status == 'ACTIVE' AND age >= 18");
      
      expect(validator.evaluateCondition(condition, { status: 'ACTIVE', age: 25 })).toBe(true);
      expect(validator.evaluateCondition(condition, { status: 'ACTIVE', age: 17 })).toBe(false);
      expect(validator.evaluateCondition(condition, { status: 'INACTIVE', age: 25 })).toBe(false);
    });

    test('should evaluate logical OR conditions', () => {
      const condition = ConditionParser.parseExpression("role == 'admin' OR role == 'superadmin'");
      
      expect(validator.evaluateCondition(condition, { role: 'admin' })).toBe(true);
      expect(validator.evaluateCondition(condition, { role: 'superadmin' })).toBe(true);
      expect(validator.evaluateCondition(condition, { role: 'user' })).toBe(false);
    });

    test('should evaluate contains conditions', () => {
      const condition = ConditionParser.parseExpression("description contains 'important'");
      
      expect(validator.evaluateCondition(condition, { description: 'This is important information' })).toBe(true);
      expect(validator.evaluateCondition(condition, { description: 'Regular information' })).toBe(false);
      
      // Test array contains
      const arrayCondition = ConditionParser.parseExpression("tags contains 'urgent'");
      expect(validator.evaluateCondition(arrayCondition, { tags: ['urgent', 'review'] })).toBe(true);
      expect(validator.evaluateCondition(arrayCondition, { tags: ['normal', 'review'] })).toBe(false);
    });
  });

  describe('Field Dependencies', () => {
    test('should add and retrieve dependencies', () => {
      const dependency: FieldDependency = {
        sourceField: 'status',
        targetField: 'emergencyContact',
        type: 'REQUIRED',
        condition: ConditionParser.parseExpression("status == 'ACTIVE'")
      };

      validator.addDependency(dependency);
      const dependencies = validator.getDependencies();
      
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toEqual(dependency);
    });

    test('should check if field is required based on dependencies', () => {
      const dependency: FieldDependency = {
        sourceField: 'status',
        targetField: 'emergencyContact',
        type: 'REQUIRED',
        condition: ConditionParser.parseExpression("status == 'ACTIVE'")
      };

      validator.addDependency(dependency);
      
      expect(validator.isFieldRequired('emergencyContact', { status: 'ACTIVE' })).toBe(true);
      expect(validator.isFieldRequired('emergencyContact', { status: 'INACTIVE' })).toBe(false);
    });

    test('should check if field is forbidden based on dependencies', () => {
      const dependency: FieldDependency = {
        sourceField: 'status',
        targetField: 'emergencyContact',
        type: 'FORBIDDEN',
        condition: ConditionParser.parseExpression("status == 'GUEST'")
      };

      validator.addDependency(dependency);
      
      expect(validator.isFieldForbidden('emergencyContact', { status: 'GUEST' })).toBe(true);
      expect(validator.isFieldForbidden('emergencyContact', { status: 'ACTIVE' })).toBe(false);
    });
  });

  describe('getApplicableRules', () => {
    test('should return applicable rules based on data', () => {
      const activeRule: ConditionalValidationRule = {
        id: 'active_rule',
        name: 'Active Rule',
        condition: ConditionParser.parseExpression("status == 'ACTIVE'"),
        validations: ['NotNull']
      };

      const adminRule: ConditionalValidationRule = {
        id: 'admin_rule',
        name: 'Admin Rule',
        condition: ConditionParser.parseExpression("role == 'admin'"),
        validations: ['StrongPassword']
      };

      validator.addRule(activeRule);
      validator.addRule(adminRule);

      const applicableRules1 = validator.getApplicableRules({ status: 'ACTIVE', role: 'user' });
      expect(applicableRules1).toHaveLength(1);
      expect(applicableRules1[0].id).toBe('active_rule');

      const applicableRules2 = validator.getApplicableRules({ status: 'ACTIVE', role: 'admin' });
      expect(applicableRules2).toHaveLength(2);
      expect(applicableRules2.map(r => r.id)).toContain('active_rule');
      expect(applicableRules2.map(r => r.id)).toContain('admin_rule');
    });
  });
});

describe('BuiltInConditionalRules', () => {
  test('should have emergency contact rule for active users', () => {
    const rule = BuiltInConditionalRules.EMERGENCY_CONTACT_FOR_ACTIVE;
    
    expect(rule.id).toBe('emergency_contact_for_active');
    expect(rule.validations).toContain('NotNull');
    expect(rule.priority).toBe(100);
  });

  test('should have phone validation rule for verified users', () => {
    const rule = BuiltInConditionalRules.PHONE_FOR_VERIFIED;
    
    expect(rule.id).toBe('phone_for_verified');
    expect(rule.validations).toContain('NotNull');
    expect(rule.validations).toContain('PhoneNumber');
    expect(rule.priority).toBe(90);
  });

  test('should have strong password rule for admin roles', () => {
    const rule = BuiltInConditionalRules.STRONG_PASSWORD_FOR_ADMIN;
    
    expect(rule.id).toBe('strong_password_for_admin');
    expect(rule.validations).toContain('StrongPassword');
    expect(rule.priority).toBe(95);
  });

  test('should have age verification rule', () => {
    const rule = BuiltInConditionalRules.AGE_VERIFICATION;
    
    expect(rule.id).toBe('age_verification');
    expect(rule.validations).toContain('NotNull');
    expect(rule.validations).toContain('Min');
    expect(rule.priority).toBe(85);
  });
});

describe('ConditionalValidationUtils', () => {
  describe('generateConditionalAnnotation', () => {
    test('should generate conditional validation annotation', () => {
      const rule: ConditionalValidationRule = {
        id: 'test_rule',
        name: 'Test Rule',
        condition: ConditionParser.parseExpression("status == 'ACTIVE'"),
        validations: ['NotNull', 'Size'],
        message: 'Field is required when status is active'
      };

      const annotation = ConditionalValidationUtils.generateConditionalAnnotation(rule);
      
      expect(annotation).toContain('@ConditionalValidation');
      expect(annotation).toContain('condition = "status == \'ACTIVE\'"');
      expect(annotation).toContain('validations = {"NotNull", "Size"}');
      expect(annotation).toContain('message = "Field is required when status is active"');
    });
  });

  describe('conditionToJavaExpression', () => {
    test('should convert simple conditions to Java expressions', () => {
      const condition = ConditionParser.parseExpression("status == 'ACTIVE'");
      const javaExpr = ConditionalValidationUtils.conditionToJavaExpression(condition);
      
      expect(javaExpr).toBe("status == 'ACTIVE'");
    });

    test('should convert numeric conditions to Java expressions', () => {
      const condition = ConditionParser.parseExpression('age >= 18');
      const javaExpr = ConditionalValidationUtils.conditionToJavaExpression(condition);
      
      expect(javaExpr).toBe('age >= 18');
    });

    test('should convert in conditions to Java expressions', () => {
      const condition = ConditionParser.parseExpression("role in ['admin', 'superadmin']");
      const javaExpr = ConditionalValidationUtils.conditionToJavaExpression(condition);
      
      expect(javaExpr).toBe("{'admin', 'superadmin'}.contains(role)");
    });

    test('should convert logical AND conditions', () => {
      const condition = ConditionParser.parseExpression("status == 'ACTIVE' AND age >= 18");
      const javaExpr = ConditionalValidationUtils.conditionToJavaExpression(condition);
      
      expect(javaExpr).toBe("(status == 'ACTIVE') && (age >= 18)");
    });

    test('should convert logical OR conditions', () => {
      const condition = ConditionParser.parseExpression("role == 'admin' OR role == 'superadmin'");
      const javaExpr = ConditionalValidationUtils.conditionToJavaExpression(condition);
      
      expect(javaExpr).toBe("(role == 'admin') || (role == 'superadmin')");
    });
  });

  describe('generateDependencyAnnotation', () => {
    test('should generate dependency annotation without condition', () => {
      const dependency: FieldDependency = {
        sourceField: 'status',
        targetField: 'emergencyContact',
        type: 'REQUIRED'
      };

      const annotation = ConditionalValidationUtils.generateDependencyAnnotation(dependency);
      
      expect(annotation).toContain('@FieldDependency');
      expect(annotation).toContain('source = "status"');
      expect(annotation).toContain('target = "emergencyContact"');
      expect(annotation).toContain('type = DependencyType.REQUIRED');
      expect(annotation).not.toContain('condition =');
    });

    test('should generate dependency annotation with condition', () => {
      const dependency: FieldDependency = {
        sourceField: 'status',
        targetField: 'emergencyContact',
        type: 'REQUIRED',
        condition: ConditionParser.parseExpression("status == 'ACTIVE'")
      };

      const annotation = ConditionalValidationUtils.generateDependencyAnnotation(dependency);
      
      expect(annotation).toContain('@FieldDependency');
      expect(annotation).toContain('source = "status"');
      expect(annotation).toContain('target = "emergencyContact"');
      expect(annotation).toContain('type = DependencyType.REQUIRED');
      expect(annotation).toContain('condition = "status == \'ACTIVE\'"');
    });
  });
});