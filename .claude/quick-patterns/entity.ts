// Vibe Entity Pattern
// 使用例: const user = User.create(id, email, name).activate();

export class ${EntityName} {
  private constructor(
    private readonly id: ${EntityName}Id,
    private readonly data: ${EntityName}Data
  ) {}

  // Factory method - 作成時のバリデーション
  static create(
    id: string,
    ...properties: PropertyTypes[]
  ): ${EntityName} {
    const entityId = ${EntityName}Id.create(id);
    const data = ${EntityName}Data.create(...properties);
    
    return new ${EntityName}(entityId, data);
  }

  // Reconstruction - データベースから復元時
  static reconstruct(
    id: string,
    data: ${EntityName}DataRaw
  ): ${EntityName} {
    const entityId = ${EntityName}Id.fromString(id);
    const entityData = ${EntityName}Data.fromRaw(data);
    
    return new ${EntityName}(entityId, entityData);
  }

  // Immutable operations - 新しいインスタンスを返す
  updateProperty(newValue: PropertyType): ${EntityName} {
    const updatedData = this.data.updateProperty(newValue);
    return new ${EntityName}(this.id, updatedData);
  }

  // Business logic - 純粋関数
  canPerformAction(): boolean {
    return this.data.isValid() && this.hasPermission();
  }

  // Query methods
  get entityId(): string {
    return this.id.value;
  }

  get property(): PropertyType {
    return this.data.property;
  }

  // Equality
  equals(other: ${EntityName}): boolean {
    return this.id.equals(other.id);
  }

  // Serialization
  toData(): ${EntityName}DataRaw {
    return this.data.toRaw();
  }

  private hasPermission(): boolean {
    // Business rule implementation
    return true;
  }
}

// Value Objects
class ${EntityName}Id {
  private constructor(public readonly value: string) {}

  static create(value: string): ${EntityName}Id {
    if (!value || value.trim().length === 0) {
      throw new Error('${EntityName} ID cannot be empty');
    }
    return new ${EntityName}Id(value.trim());
  }

  static fromString(value: string): ${EntityName}Id {
    return new ${EntityName}Id(value);
  }

  equals(other: ${EntityName}Id): boolean {
    return this.value === other.value;
  }
}

class ${EntityName}Data {
  private constructor(
    public readonly property: PropertyType
    // Add more properties as needed
  ) {}

  static create(...properties: PropertyTypes[]): ${EntityName}Data {
    // Validation logic
    return new ${EntityName}Data(...properties);
  }

  static fromRaw(raw: ${EntityName}DataRaw): ${EntityName}Data {
    return new ${EntityName}Data(raw.property);
  }

  updateProperty(newValue: PropertyType): ${EntityName}Data {
    return new ${EntityName}Data(newValue);
  }

  isValid(): boolean {
    // Validation logic
    return this.property != null;
  }

  toRaw(): ${EntityName}DataRaw {
    return {
      property: this.property
    };
  }
}

// Type definitions
type PropertyType = string; // Define actual type
type PropertyTypes = PropertyType[]; // Define actual types
interface ${EntityName}DataRaw {
  property: PropertyType;
  // Add more properties as needed
}