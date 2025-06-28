# Controller Interface と OpenAPI スキーマの対応例

## 概要

このドキュメントでは、OpenAPIスキーマ定義からController interfaceの実装まで、具体的なマッピング例を示します。Spring Boot、Express.js、ASP.NET Coreでの実装パターンを含みます。

## 基本マッピング原則

### 1. OpenAPI → Controller メソッドマッピング

| OpenAPI要素 | Controller要素 | 説明 |
|------------|---------------|------|
| `paths` | HTTPメソッド + URL | エンドポイントの定義 |
| `operationId` | メソッド名 | 操作の識別子 |
| `parameters` | メソッド引数 | リクエストパラメータ |
| `requestBody` | メソッド引数 | リクエストボディ |
| `responses` | 戻り値の型 | レスポンスの型定義 |
| `tags` | Controller クラス | 機能グループ |

### 2. データ型マッピング

| OpenAPI型 | Java (Spring Boot) | TypeScript | C# (.NET) |
|----------|-------------------|------------|-----------|
| `integer` | `Integer`, `Long` | `number` | `int`, `long` |
| `number` | `Double`, `BigDecimal` | `number` | `double`, `decimal` |
| `string` | `String` | `string` | `string` |
| `boolean` | `Boolean` | `boolean` | `bool` |
| `array` | `List<T>` | `T[]` | `List<T>` |
| `object` | POJO クラス | interface | class/record |
| `string(date-time)` | `LocalDateTime` | `Date` | `DateTime` |

## Spring Boot実装例

### OpenAPIスキーマ
```yaml
# 前述のUser Management APIのスキーマを使用
paths:
  /users:
    get:
      operationId: getUsers
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 0
        - name: size
          in: query
          schema:
            type: integer
            default: 20
        - name: status
          in: query
          schema:
            $ref: '#/components/schemas/UserStatus'
```

### 対応するController実装

```java
@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Users", description = "ユーザー管理API")
@Validated
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @Operation(
        operationId = "getUsers",
        summary = "ユーザー一覧取得",
        description = "条件に基づいてユーザー一覧を取得します"
    )
    @ApiResponses({
        @ApiResponse(
            responseCode = "200",
            description = "ユーザー一覧取得成功",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = UserListResponse.class)
            )
        ),
        @ApiResponse(
            responseCode = "400",
            description = "不正なリクエスト",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = ErrorResponse.class)
            )
        )
    })
    public ResponseEntity<UserListResponse> getUsers(
        @Parameter(description = "ページ番号（0から開始）")
        @RequestParam(defaultValue = "0") 
        @Min(0) Integer page,
        
        @Parameter(description = "ページサイズ")
        @RequestParam(defaultValue = "20") 
        @Min(1) @Max(100) Integer size,
        
        @Parameter(description = "ステータスでフィルタ")
        @RequestParam(required = false) UserStatus status,
        
        @Parameter(description = "ユーザー名または名前で検索")
        @RequestParam(required = false) 
        @Size(max = 100) String search
    ) {
        UserListResponse response = userService.getUsers(page, size, status, search);
        return ResponseEntity.ok(response);
    }

    @PostMapping
    @Operation(
        operationId = "createUser",
        summary = "ユーザー作成",
        description = "新しいユーザーを作成します"
    )
    @ApiResponses({
        @ApiResponse(
            responseCode = "201",
            description = "ユーザー作成成功",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = User.class)
            )
        ),
        @ApiResponse(
            responseCode = "400",
            description = "不正なリクエスト"
        ),
        @ApiResponse(
            responseCode = "409",
            description = "ユーザー名またはメールアドレスが既に存在"
        )
    })
    public ResponseEntity<User> createUser(
        @Valid @RequestBody CreateUserRequest request
    ) {
        User createdUser = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdUser);
    }

    @GetMapping("/{userId}")
    @Operation(
        operationId = "getUserById",
        summary = "ユーザー詳細取得",
        description = "指定されたIDのユーザー詳細を取得します"
    )
    public ResponseEntity<User> getUserById(
        @Parameter(description = "ユーザーID", required = true)
        @PathVariable @Min(1) Long userId
    ) {
        User user = userService.getUserById(userId);
        return ResponseEntity.ok(user);
    }

    @PutMapping("/{userId}")
    @Operation(
        operationId = "updateUser",
        summary = "ユーザー更新",
        description = "指定されたIDのユーザー情報を更新します"
    )
    public ResponseEntity<User> updateUser(
        @Parameter(description = "ユーザーID", required = true)
        @PathVariable @Min(1) Long userId,
        
        @Valid @RequestBody UpdateUserRequest request
    ) {
        User updatedUser = userService.updateUser(userId, request);
        return ResponseEntity.ok(updatedUser);
    }

    @DeleteMapping("/{userId}")
    @Operation(
        operationId = "deleteUser",
        summary = "ユーザー削除",
        description = "指定されたIDのユーザーを削除します"
    )
    @ApiResponse(responseCode = "204", description = "ユーザー削除成功")
    public ResponseEntity<Void> deleteUser(
        @Parameter(description = "ユーザーID", required = true)
        @PathVariable @Min(1) Long userId
    ) {
        userService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }
}
```

### DTO クラス実装

```java
// User エンティティ
@Schema(description = "ユーザー情報")
public class User {
    
    @Schema(description = "ユーザーの一意識別子", example = "12345")
    private Long id;
    
    @Schema(description = "ユーザー名（英数字とアンダースコアのみ）", example = "john_doe")
    @NotBlank
    @Size(min = 3, max = 50)
    @Pattern(regexp = "^[a-zA-Z0-9_]+$")
    private String username;
    
    @Schema(description = "メールアドレス", example = "john@example.com")
    @NotBlank
    @Email
    private String email;
    
    @Schema(description = "名前", example = "John")
    @Size(max = 100)
    private String firstName;
    
    @Schema(description = "姓", example = "Doe")
    @Size(max = 100)
    private String lastName;
    
    @Schema(description = "年齢", example = "30")
    @Min(0)
    @Max(150)
    private Integer age;
    
    @Schema(description = "ユーザーのステータス")
    private UserStatus status;
    
    @Schema(description = "作成日時", example = "2024-01-15T10:30:00Z")
    private LocalDateTime createdAt;
    
    @Schema(description = "更新日時", example = "2024-01-15T10:30:00Z")
    private LocalDateTime updatedAt;
    
    // コンストラクタ、getter、setter省略
}

// CreateUserRequest DTO
@Schema(description = "ユーザー作成リクエスト")
public class CreateUserRequest {
    
    @Schema(description = "ユーザー名", required = true)
    @NotBlank
    @Size(min = 3, max = 50)
    @Pattern(regexp = "^[a-zA-Z0-9_]+$")
    private String username;
    
    @Schema(description = "メールアドレス", required = true)
    @NotBlank
    @Email
    private String email;
    
    @Schema(description = "名前", required = true)
    @NotBlank
    @Size(max = 100)
    private String firstName;
    
    @Schema(description = "姓", required = true)
    @NotBlank
    @Size(max = 100)
    private String lastName;
    
    @Schema(description = "年齢")
    @Min(0)
    @Max(150)
    private Integer age;
    
    // getter、setter省略
}

// UserStatus enum
@Schema(description = "ユーザーのステータス")
public enum UserStatus {
    @Schema(description = "アクティブ")
    ACTIVE("active"),
    
    @Schema(description = "非アクティブ")
    INACTIVE("inactive"),
    
    @Schema(description = "停止中")
    SUSPENDED("suspended");
    
    private final String value;
    
    UserStatus(String value) {
        this.value = value;
    }
    
    @JsonValue
    public String getValue() {
        return value;
    }
}
```

## Express.js (TypeScript) 実装例

### Controller実装

```typescript
import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { UserService } from '../services/UserService';
import { 
    User, 
    CreateUserRequest, 
    UpdateUserRequest, 
    UserListResponse, 
    UserStatus,
    ErrorResponse 
} from '../types/api';

/**
 * ユーザー管理API Controller
 * OpenAPI operationId に対応するメソッドを実装
 */
export class UserController {
    
    constructor(private userService: UserService) {}

    /**
     * ユーザー一覧取得 (operationId: getUsers)
     * GET /api/v1/users
     */
    async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // バリデーションエラーチェック
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorResponse: ErrorResponse = {
                    error: 'VALIDATION_ERROR',
                    message: '入力パラメータに問題があります',
                    details: errors.array().map(err => ({
                        field: err.param,
                        code: 'INVALID_VALUE',
                        message: err.msg,
                        rejectedValue: err.value
                    })),
                    timestamp: new Date().toISOString()
                };
                res.status(400).json(errorResponse);
                return;
            }

            const page = parseInt(req.query.page as string) || 0;
            const size = parseInt(req.query.size as string) || 20;
            const status = req.query.status as UserStatus | undefined;
            const search = req.query.search as string | undefined;

            const result: UserListResponse = await this.userService.getUsers(
                page, size, status, search
            );

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * ユーザー作成 (operationId: createUser)
     * POST /api/v1/users
     */
    async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorResponse: ErrorResponse = {
                    error: 'VALIDATION_ERROR',
                    message: '入力データに問題があります',
                    details: errors.array().map(err => ({
                        field: err.param,
                        code: 'INVALID_VALUE',
                        message: err.msg,
                        rejectedValue: err.value
                    })),
                    timestamp: new Date().toISOString()
                };
                res.status(400).json(errorResponse);
                return;
            }

            const createRequest: CreateUserRequest = req.body;
            const createdUser: User = await this.userService.createUser(createRequest);

            res.status(201).json(createdUser);
        } catch (error) {
            next(error);
        }
    }

    /**
     * ユーザー詳細取得 (operationId: getUserById)
     * GET /api/v1/users/:userId
     */
    async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorResponse: ErrorResponse = {
                    error: 'VALIDATION_ERROR',
                    message: 'ユーザーIDが不正です',
                    details: errors.array().map(err => ({
                        field: err.param,
                        code: 'INVALID_VALUE',
                        message: err.msg,
                        rejectedValue: err.value
                    })),
                    timestamp: new Date().toISOString()
                };
                res.status(400).json(errorResponse);
                return;
            }

            const userId = parseInt(req.params.userId);
            const user: User = await this.userService.getUserById(userId);

            res.status(200).json(user);
        } catch (error) {
            next(error);
        }
    }

    /**
     * ユーザー更新 (operationId: updateUser)
     * PUT /api/v1/users/:userId
     */
    async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorResponse: ErrorResponse = {
                    error: 'VALIDATION_ERROR',
                    message: '入力データに問題があります',
                    details: errors.array().map(err => ({
                        field: err.param,
                        code: 'INVALID_VALUE',
                        message: err.msg,
                        rejectedValue: err.value
                    })),
                    timestamp: new Date().toISOString()
                };
                res.status(400).json(errorResponse);
                return;
            }

            const userId = parseInt(req.params.userId);
            const updateRequest: UpdateUserRequest = req.body;
            const updatedUser: User = await this.userService.updateUser(userId, updateRequest);

            res.status(200).json(updatedUser);
        } catch (error) {
            next(error);
        }
    }

    /**
     * ユーザー削除 (operationId: deleteUser)
     * DELETE /api/v1/users/:userId
     */
    async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorResponse: ErrorResponse = {
                    error: 'VALIDATION_ERROR',
                    message: 'ユーザーIDが不正です',
                    details: errors.array().map(err => ({
                        field: err.param,
                        code: 'INVALID_VALUE',
                        message: err.msg,
                        rejectedValue: err.value
                    })),
                    timestamp: new Date().toISOString()
                };
                res.status(400).json(errorResponse);
                return;
            }

            const userId = parseInt(req.params.userId);
            await this.userService.deleteUser(userId);

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}

/**
 * バリデーションルール定義
 * OpenAPIスキーマのバリデーション仕様に対応
 */
export const getUsersValidation = [
    query('page')
        .optional()
        .isInt({ min: 0 })
        .withMessage('ページ番号は0以上の整数である必要があります'),
    query('size')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('ページサイズは1以上100以下の整数である必要があります'),
    query('status')
        .optional()
        .isIn(['active', 'inactive', 'suspended'])
        .withMessage('ステータスは active, inactive, suspended のいずれかである必要があります'),
    query('search')
        .optional()
        .isLength({ max: 100 })
        .withMessage('検索キーワードは100文字以下である必要があります')
];

export const createUserValidation = [
    body('username')
        .notEmpty()
        .withMessage('ユーザー名は必須です')
        .isLength({ min: 3, max: 50 })
        .withMessage('ユーザー名は3文字以上50文字以下である必要があります')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('ユーザー名は英数字とアンダースコアのみ使用可能です'),
    body('email')
        .notEmpty()
        .withMessage('メールアドレスは必須です')
        .isEmail()
        .withMessage('有効なメールアドレスを入力してください'),
    body('firstName')
        .notEmpty()
        .withMessage('名前は必須です')
        .isLength({ max: 100 })
        .withMessage('名前は100文字以下である必要があります'),
    body('lastName')
        .notEmpty()
        .withMessage('姓は必須です')
        .isLength({ max: 100 })
        .withMessage('姓は100文字以下である必要があります'),
    body('age')
        .optional()
        .isInt({ min: 0, max: 150 })
        .withMessage('年齢は0以上150以下の整数である必要があります')
];

export const updateUserValidation = [
    param('userId')
        .isInt({ min: 1 })
        .withMessage('ユーザーIDは1以上の整数である必要があります'),
    body('firstName')
        .optional()
        .isLength({ max: 100 })
        .withMessage('名前は100文字以下である必要があります'),
    body('lastName')
        .optional()
        .isLength({ max: 100 })
        .withMessage('姓は100文字以下である必要があります'),
    body('age')
        .optional()
        .isInt({ min: 0, max: 150 })
        .withMessage('年齢は0以上150以下の整数である必要があります'),
    body('status')
        .optional()
        .isIn(['active', 'inactive', 'suspended'])
        .withMessage('ステータスは active, inactive, suspended のいずれかである必要があります')
];

export const userIdValidation = [
    param('userId')
        .isInt({ min: 1 })
        .withMessage('ユーザーIDは1以上の整数である必要があります')
];
```

### TypeScript型定義

```typescript
// OpenAPIスキーマに対応する型定義

/**
 * ユーザーのステータス
 */
export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    SUSPENDED = 'suspended'
}

/**
 * ユーザー情報
 */
export interface User {
    /** ユーザーの一意識別子 */
    id: number;
    /** ユーザー名（英数字とアンダースコアのみ） */
    username: string;
    /** メールアドレス */
    email: string;
    /** 名前 */
    firstName?: string;
    /** 姓 */
    lastName?: string;
    /** 年齢 */
    age?: number;
    /** ユーザーのステータス */
    status?: UserStatus;
    /** 作成日時 */
    createdAt: string;
    /** 更新日時 */
    updatedAt: string;
}

/**
 * ユーザー作成リクエスト
 */
export interface CreateUserRequest {
    /** ユーザー名 */
    username: string;
    /** メールアドレス */
    email: string;
    /** 名前 */
    firstName: string;
    /** 姓 */
    lastName: string;
    /** 年齢 */
    age?: number;
}

/**
 * ユーザー更新リクエスト
 */
export interface UpdateUserRequest {
    /** 名前 */
    firstName?: string;
    /** 姓 */
    lastName?: string;
    /** 年齢 */
    age?: number;
    /** ユーザーのステータス */
    status?: UserStatus;
}

/**
 * ページネーション情報
 */
export interface PaginationInfo {
    /** 現在のページ番号（0から開始） */
    page: number;
    /** ページサイズ */
    size: number;
    /** 総要素数 */
    totalElements: number;
    /** 総ページ数 */
    totalPages: number;
}

/**
 * ユーザー一覧レスポンス
 */
export interface UserListResponse {
    /** ユーザー一覧 */
    users: User[];
    /** ページネーション情報 */
    pagination: PaginationInfo;
}

/**
 * エラー詳細情報
 */
export interface ErrorDetail {
    /** エラーが発生したフィールド */
    field: string;
    /** フィールド固有のエラーコード */
    code: string;
    /** フィールド固有のエラーメッセージ */
    message: string;
    /** 拒否された値 */
    rejectedValue?: any;
}

/**
 * エラーレスポンス
 */
export interface ErrorResponse {
    /** エラーコード（機械可読） */
    error: string;
    /** エラーメッセージ（人間可読） */
    message: string;
    /** 詳細なエラー情報 */
    details?: ErrorDetail[];
    /** エラー発生日時 */
    timestamp: string;
    /** トレースID（デバッグ用） */
    traceId?: string;
}
```

## ASP.NET Core実装例

### Controller実装

```csharp
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using Swashbuckle.AspNetCore.Annotations;

[ApiController]
[Route("api/v1/[controller]")]
[SwaggerTag("Users", "ユーザー管理API")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    /// <summary>
    /// ユーザー一覧取得
    /// </summary>
    /// <param name="page">ページ番号（0から開始）</param>
    /// <param name="size">ページサイズ</param>
    /// <param name="status">ステータスでフィルタ</param>
    /// <param name="search">ユーザー名または名前で検索</param>
    /// <returns>ユーザー一覧</returns>
    [HttpGet]
    [SwaggerOperation(
        OperationId = "getUsers",
        Summary = "ユーザー一覧取得",
        Description = "条件に基づいてユーザー一覧を取得します"
    )]
    [SwaggerResponse(200, "ユーザー一覧取得成功", typeof(UserListResponse))]
    [SwaggerResponse(400, "不正なリクエスト", typeof(ErrorResponse))]
    [SwaggerResponse(500, "サーバーエラー", typeof(ErrorResponse))]
    public async Task<ActionResult<UserListResponse>> GetUsers(
        [FromQuery, Range(0, int.MaxValue)] int page = 0,
        [FromQuery, Range(1, 100)] int size = 20,
        [FromQuery] UserStatus? status = null,
        [FromQuery, MaxLength(100)] string? search = null)
    {
        try
        {
            var result = await _userService.GetUsersAsync(page, size, status, search);
            return Ok(result);
        }
        catch (ValidationException ex)
        {
            var errorResponse = new ErrorResponse
            {
                Error = "VALIDATION_ERROR",
                Message = ex.Message,
                Timestamp = DateTime.UtcNow
            };
            return BadRequest(errorResponse);
        }
    }

    /// <summary>
    /// ユーザー作成
    /// </summary>
    /// <param name="request">ユーザー作成リクエスト</param>
    /// <returns>作成されたユーザー</returns>
    [HttpPost]
    [SwaggerOperation(
        OperationId = "createUser",
        Summary = "ユーザー作成",
        Description = "新しいユーザーを作成します"
    )]
    [SwaggerResponse(201, "ユーザー作成成功", typeof(User))]
    [SwaggerResponse(400, "不正なリクエスト", typeof(ErrorResponse))]
    [SwaggerResponse(409, "ユーザー名またはメールアドレスが既に存在", typeof(ErrorResponse))]
    public async Task<ActionResult<User>> CreateUser([FromBody] CreateUserRequest request)
    {
        try
        {
            var createdUser = await _userService.CreateUserAsync(request);
            return CreatedAtAction(nameof(GetUserById), new { userId = createdUser.Id }, createdUser);
        }
        catch (DuplicateUserException ex)
        {
            var errorResponse = new ErrorResponse
            {
                Error = "DUPLICATE_USER",
                Message = ex.Message,
                Timestamp = DateTime.UtcNow
            };
            return Conflict(errorResponse);
        }
    }

    /// <summary>
    /// ユーザー詳細取得
    /// </summary>
    /// <param name="userId">ユーザーID</param>
    /// <returns>ユーザー詳細</returns>
    [HttpGet("{userId}")]
    [SwaggerOperation(
        OperationId = "getUserById",
        Summary = "ユーザー詳細取得",
        Description = "指定されたIDのユーザー詳細を取得します"
    )]
    [SwaggerResponse(200, "ユーザー詳細取得成功", typeof(User))]
    [SwaggerResponse(404, "ユーザーが見つかりません", typeof(ErrorResponse))]
    public async Task<ActionResult<User>> GetUserById([FromRoute, Range(1, long.MaxValue)] long userId)
    {
        try
        {
            var user = await _userService.GetUserByIdAsync(userId);
            return Ok(user);
        }
        catch (UserNotFoundException ex)
        {
            var errorResponse = new ErrorResponse
            {
                Error = "USER_NOT_FOUND",
                Message = ex.Message,
                Timestamp = DateTime.UtcNow
            };
            return NotFound(errorResponse);
        }
    }

    /// <summary>
    /// ユーザー更新
    /// </summary>
    /// <param name="userId">ユーザーID</param>
    /// <param name="request">ユーザー更新リクエスト</param>
    /// <returns>更新されたユーザー</returns>
    [HttpPut("{userId}")]
    [SwaggerOperation(
        OperationId = "updateUser",
        Summary = "ユーザー更新",
        Description = "指定されたIDのユーザー情報を更新します"
    )]
    [SwaggerResponse(200, "ユーザー更新成功", typeof(User))]
    [SwaggerResponse(400, "不正なリクエスト", typeof(ErrorResponse))]
    [SwaggerResponse(404, "ユーザーが見つかりません", typeof(ErrorResponse))]
    public async Task<ActionResult<User>> UpdateUser(
        [FromRoute, Range(1, long.MaxValue)] long userId,
        [FromBody] UpdateUserRequest request)
    {
        try
        {
            var updatedUser = await _userService.UpdateUserAsync(userId, request);
            return Ok(updatedUser);
        }
        catch (UserNotFoundException ex)
        {
            var errorResponse = new ErrorResponse
            {
                Error = "USER_NOT_FOUND",
                Message = ex.Message,
                Timestamp = DateTime.UtcNow
            };
            return NotFound(errorResponse);
        }
    }

    /// <summary>
    /// ユーザー削除
    /// </summary>
    /// <param name="userId">ユーザーID</param>
    /// <returns>削除結果</returns>
    [HttpDelete("{userId}")]
    [SwaggerOperation(
        OperationId = "deleteUser",
        Summary = "ユーザー削除",
        Description = "指定されたIDのユーザーを削除します"
    )]
    [SwaggerResponse(204, "ユーザー削除成功")]
    [SwaggerResponse(404, "ユーザーが見つかりません", typeof(ErrorResponse))]
    public async Task<ActionResult> DeleteUser([FromRoute, Range(1, long.MaxValue)] long userId)
    {
        try
        {
            await _userService.DeleteUserAsync(userId);
            return NoContent();
        }
        catch (UserNotFoundException ex)
        {
            var errorResponse = new ErrorResponse
            {
                Error = "USER_NOT_FOUND",
                Message = ex.Message,
                Timestamp = DateTime.UtcNow
            };
            return NotFound(errorResponse);
        }
    }
}
```

## バリデーション実装パターン

### 1. Spring Boot - Bean Validation

```java
// カスタムバリデーション アノテーション
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = UsernameValidator.class)
public @interface ValidUsername {
    String message() default "ユーザー名は英数字とアンダースコアのみ使用可能です";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

// バリデーター実装
public class UsernameValidator implements ConstraintValidator<ValidUsername, String> {
    
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_]+$");
    
    @Override
    public boolean isValid(String username, ConstraintValidatorContext context) {
        if (username == null) {
            return true; // @NotNull で別途チェック
        }
        return USERNAME_PATTERN.matcher(username).matches();
    }
}

// 使用例
public class CreateUserRequest {
    @NotBlank(message = "ユーザー名は必須です")
    @Size(min = 3, max = 50, message = "ユーザー名は3文字以上50文字以下である必要があります")
    @ValidUsername
    private String username;
}
```

### 2. Express.js - カスタムバリデーション

```typescript
// カスタムバリデーション関数
export const isValidUsername = (value: string): boolean => {
    const usernamePattern = /^[a-zA-Z0-9_]+$/;
    return usernamePattern.test(value);
};

// express-validator用カスタムバリデーター
export const usernameValidation = body('username')
    .notEmpty()
    .withMessage('ユーザー名は必須です')
    .isLength({ min: 3, max: 50 })
    .withMessage('ユーザー名は3文字以上50文字以下である必要があります')
    .custom((value: string) => {
        if (!isValidUsername(value)) {
            throw new Error('ユーザー名は英数字とアンダースコアのみ使用可能です');
        }
        return true;
    });
```

## エラーハンドリング実装

### 統一エラーレスポンス

```java
// Spring Boot - グローバル例外ハンドラー
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex) {
        
        List<ErrorDetail> details = ex.getBindingResult().getFieldErrors().stream()
            .map(error -> ErrorDetail.builder()
                .field(error.getField())
                .code("VALIDATION_ERROR")
                .message(error.getDefaultMessage())
                .rejectedValue(error.getRejectedValue())
                .build())
            .collect(Collectors.toList());

        ErrorResponse errorResponse = ErrorResponse.builder()
            .error("VALIDATION_ERROR")
            .message("入力データに問題があります")
            .details(details)
            .timestamp(LocalDateTime.now())
            .build();

        return ResponseEntity.badRequest().body(errorResponse);
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUserNotFoundException(
            UserNotFoundException ex) {
        
        ErrorResponse errorResponse = ErrorResponse.builder()
            .error("USER_NOT_FOUND")
            .message(ex.getMessage())
            .timestamp(LocalDateTime.now())
            .build();

        return ResponseEntity.notFound().build();
    }
}
```

この実装パターンにより、OpenAPIスキーマ定義と実際のController実装の間で一貫性を保ち、型安全で保守性の高いAPIを構築できます。