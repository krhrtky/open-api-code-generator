# DDD コード実装例

## 概要

本ドキュメントは、DDDアーキテクチャに基づいたバックエンドの具体的なコード実装例を提供します。
関数型プログラミングの原則に従い、副作用を最小限に抑えた実装パターンを示します。

## Domain Layer（ドメイン層）

### Value Object（値オブジェクト）

```kotlin
// Email値オブジェクト - イミュータブルで検証ロジックを含む
data class Email private constructor(val value: String) {
    companion object {
        private val EMAIL_REGEX = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
        
        fun create(value: String): Email {
            if (!isValid(value)) {
                throw InvalidEmailError("Invalid email format: $value")
            }
            return Email(value)
        }
        
        private fun isValid(value: String): Boolean {
            return EMAIL_REGEX.matches(value)
        }
    }
    
    override fun equals(other: Any?): Boolean {
        return other is Email && this.value == other.value
    }
    
    override fun hashCode(): Int {
        return value.hashCode()
    }
}

// UserId値オブジェクト
data class UserId private constructor(val value: String) {
    companion object {
        fun create(value: String): UserId {
            if (value.isBlank()) {
                throw InvalidUserIdError("UserId cannot be empty")
            }
            return UserId(value)
        }
    }
    
    override fun equals(other: Any?): Boolean {
        return other is UserId && this.value == other.value
    }
    
    override fun hashCode(): Int {
        return value.hashCode()
    }
}
```

### Entity（エンティティ）

```kotlin
// User エンティティ - 純粋関数のみでビジネスロジックを実装
data class User private constructor(
    val id: UserId,
    val email: Email,
    val name: String,
    val status: UserStatus,
    val createdAt: LocalDateTime
) {
    companion object {
        fun create(
            id: UserId,
            email: Email,
            name: String
        ): User {
            return User(
                id = id,
                email = email,
                name = name,
                status = UserStatus.ACTIVE,
                createdAt = LocalDateTime.now()
            )
        }

        fun reconstruct(
            id: UserId,
            email: Email,
            name: String,
            status: UserStatus,
            createdAt: LocalDateTime
        ): User {
            return User(id, email, name, status, createdAt)
        }
    }

    // 純粋関数：新しいインスタンスを返す
    fun changeName(newName: String): User {
        if (newName.isBlank()) {
            throw InvalidUserNameError("Name cannot be empty")
        }
        
        return this.copy(name = newName.trim())
    }

    // 純粋関数：状態変更
    fun deactivate(): User {
        if (status == UserStatus.INACTIVE) {
            throw UserAlreadyInactiveError("User is already inactive")
        }

        return this.copy(status = UserStatus.INACTIVE)
    }

    // 純粋関数：ビジネスルール判定
    fun canUpdateProfile(): Boolean {
        return status == UserStatus.ACTIVE
    }

    fun isOlderThan(days: Long): Boolean {
        val targetDate = LocalDateTime.now().minusDays(days)
        return createdAt.isBefore(targetDate)
    }
}

enum class UserStatus {
    ACTIVE,
    INACTIVE
}
```

### Repository Interface（リポジトリインターフェース）

```kotlin
// ドメイン層でのリポジトリインターフェース定義
interface UserRepository {
    suspend fun findById(id: UserId): User?
    suspend fun findByEmail(email: Email): User?
    suspend fun save(user: User)
    suspend fun delete(id: UserId)
    suspend fun findActiveUsers(): List<User>
}

interface UserQuery {
    suspend fun countActiveUsers(): Int
    suspend fun findUsersCreatedAfter(date: LocalDateTime): List<User>
}
```

### Domain Service（ドメインサービス）

```kotlin
// 複数のエンティティに跨るビジネスロジック
object UserDomainService {
    // 純粋関数：複数ユーザーの重複チェック
    fun hasDuplicateEmails(users: List<User>): Boolean {
        val emails = users.map { it.email.value }
        val uniqueEmails = emails.toSet()
        return emails.size != uniqueEmails.size
    }

    // 純粋関数：ユーザーグループの統計計算
    fun calculateUserStatistics(users: List<User>): UserStatistics {
        val activeCount = users.count { user -> 
            user.status == UserStatus.ACTIVE
        }
        
        val inactiveCount = users.size - activeCount
        
        val oldUsers = users.count { user -> 
            user.isOlderThan(365)
        }

        return UserStatistics(activeCount, inactiveCount, oldUsers)
    }
}

data class UserStatistics(
    val activeCount: Int,
    val inactiveCount: Int,
    val oldUserCount: Int
) {
    fun getTotalCount(): Int {
        return activeCount + inactiveCount
    }

    fun getActiveRatio(): Double {
        val total = getTotalCount()
        return if (total == 0) 0.0 else activeCount.toDouble() / total
    }
}
```

## Application Layer（アプリケーション層）

### Use Case（ユースケース）

```kotlin
// ユーザー作成ユースケース
class CreateUserUseCase(
    private val userRepository: UserRepository,
    private val userQuery: UserQuery
) {
    suspend fun execute(command: CreateUserCommand): CreateUserResult {
        // 入力値の値オブジェクト変換（バリデーション含む）
        val email = Email.create(command.email)
        val userId = UserId.create(command.userId)

        // ビジネスルール：重複チェック（副作用あり）
        val existingUser = userRepository.findByEmail(email)
        if (existingUser != null) {
            throw UserAlreadyExistsError("User with email ${email.value} already exists")
        }

        // ドメインエンティティ作成（純粋関数）
        val user = User.create(userId, email, command.name)

        // 永続化（副作用）
        userRepository.save(user)

        return CreateUserResult(user.id.value, user.email.value)
    }
}

// コマンドオブジェクト
data class CreateUserCommand(
    val userId: String,
    val email: String,
    val name: String
)

data class CreateUserResult(
    val userId: String,
    val email: String
)
```

```kotlin
// ユーザー更新ユースケース
class UpdateUserUseCase(
    private val userRepository: UserRepository
) {
    suspend fun execute(command: UpdateUserCommand) {
        val userId = UserId.create(command.userId)

        // データ取得（副作用）
        val user = userRepository.findById(userId)
            ?: throw UserNotFoundError("User not found: ${userId.value}")

        // ビジネスルール検証（純粋関数）
        if (!user.canUpdateProfile()) {
            throw UserCannotUpdateProfileError("Inactive user cannot update profile")
        }

        // ドメインロジック実行（純粋関数）
        val updatedUser = user.changeName(command.newName)

        // 永続化（副作用）
        userRepository.save(updatedUser)
    }
}

data class UpdateUserCommand(
    val userId: String,
    val newName: String
)
```

## Infrastructure Layer（インフラストラクチャ層）

### Repository Implementation（リポジトリ実装）

```kotlin
// リポジトリの具象実装（副作用を含む）
class PostgreSQLUserRepository(
    private val connection: Connection
) : UserRepository {

    override suspend fun findById(id: UserId): User? {
        val query = "SELECT * FROM users WHERE id = ?"
        val result = connection.query(query, id.value)
        
        return if (result.rows.isEmpty()) {
            null
        } else {
            mapToUser(result.rows[0])
        }
    }

    override suspend fun findByEmail(email: Email): User? {
        val query = "SELECT * FROM users WHERE email = ?"
        val result = connection.query(query, email.value)
        
        return if (result.rows.isEmpty()) {
            null
        } else {
            mapToUser(result.rows[0])
        }
    }

    override suspend fun save(user: User) {
        val query = """
            INSERT INTO users (id, email, name, status, created_at) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                email = VALUES(email),
                name = VALUES(name),
                status = VALUES(status)
        """

        connection.execute(query, 
            user.id.value,
            user.email.value,
            user.name,
            user.status.name,
            user.createdAt
        )
    }

    override suspend fun delete(id: UserId) {
        val query = "DELETE FROM users WHERE id = ?"
        connection.execute(query, id.value)
    }

    override suspend fun findActiveUsers(): List<User> {
        val query = "SELECT * FROM users WHERE status = ?"
        val result = connection.query(query, UserStatus.ACTIVE.name)
        
        return result.rows.map { row -> mapToUser(row) }
    }

    // データベース行からドメインエンティティへの変換
    private fun mapToUser(row: ResultRow): User {
        return User.reconstruct(
            id = UserId.create(row.getString("id")),
            email = Email.create(row.getString("email")),
            name = row.getString("name"),
            status = UserStatus.valueOf(row.getString("status")),
            createdAt = row.getLocalDateTime("created_at")
        )
    }
}
```

## Presentation Layer（表現層）

### Controller（コントローラー）

```kotlin
// HTTP コントローラー
@RestController
@RequestMapping("/api/users")
class UserController(
    private val createUserUseCase: CreateUserUseCase,
    private val updateUserUseCase: UpdateUserUseCase
) {

    @PostMapping
    suspend fun createUser(@RequestBody request: CreateUserRequest): ResponseEntity<CreateUserResponse> {
        return try {
            val command = CreateUserCommand(
                userId = request.userId,
                email = request.email,
                name = request.name
            )

            val result = createUserUseCase.execute(command)

            ResponseEntity.status(HttpStatus.CREATED)
                .body(CreateUserResponse(
                    success = true,
                    data = UserData(
                        userId = result.userId,
                        email = result.email
                    )
                ))
        } catch (error: Exception) {
            handleError(error)
        }
    }

    @PutMapping("/{userId}")
    suspend fun updateUser(
        @PathVariable userId: String,
        @RequestBody request: UpdateUserRequest
    ): ResponseEntity<UpdateUserResponse> {
        return try {
            val command = UpdateUserCommand(
                userId = userId,
                newName = request.name
            )

            updateUserUseCase.execute(command)

            ResponseEntity.ok(UpdateUserResponse(
                success = true,
                message = "User updated successfully"
            ))
        } catch (error: Exception) {
            handleError(error)
        }
    }

    private fun handleError(error: Exception): ResponseEntity<ErrorResponse> {
        return when (error) {
            is UserAlreadyExistsError -> 
                ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ErrorResponse(error.message ?: "User already exists"))
            is UserNotFoundError -> 
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ErrorResponse(error.message ?: "User not found"))
            is InvalidEmailError, is InvalidUserNameError -> 
                ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ErrorResponse(error.message ?: "Invalid input"))
            else -> 
                ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorResponse("Internal server error"))
        }
    }
}

// Request/Response DTOs
data class CreateUserRequest(
    val userId: String,
    val email: String,
    val name: String
)

data class CreateUserResponse(
    val success: Boolean,
    val data: UserData
)

data class UpdateUserRequest(
    val name: String
)

data class UpdateUserResponse(
    val success: Boolean,
    val message: String
)

data class UserData(
    val userId: String,
    val email: String
)

data class ErrorResponse(
    val error: String
)
```

## Error Classes（エラークラス）

```kotlin
// ドメインエラー
sealed class DomainError(message: String) : Exception(message)

class InvalidEmailError(message: String) : DomainError(message)
class InvalidUserIdError(message: String) : DomainError(message)
class InvalidUserNameError(message: String) : DomainError(message)
class UserAlreadyExistsError(message: String) : DomainError(message)
class UserNotFoundError(message: String) : DomainError(message)
class UserAlreadyInactiveError(message: String) : DomainError(message)
class UserCannotUpdateProfileError(message: String) : DomainError(message)
```

## テストコード例

```kotlin
// ドメインエンティティのテスト（純粋関数のテスト）
class UserTest {

    @Test
    fun `should create user with valid parameters`() {
        val userId = UserId.create("user-123")
        val email = Email.create("test@example.com")
        val name = "Test User"

        val user = User.create(userId, email, name)

        assertEquals("user-123", user.id.value)
        assertEquals("test@example.com", user.email.value)
        assertEquals("Test User", user.name)
        assertEquals(UserStatus.ACTIVE, user.status)
    }

    @Test
    fun `should change name and return new instance`() {
        val user = createTestUser()
        val newName = "Updated Name"

        val updatedUser = user.changeName(newName)

        assertEquals(newName, updatedUser.name)
        assertEquals("Test User", user.name) // 元のインスタンスは変更されない
        assertNotSame(user, updatedUser) // 異なるインスタンス
    }

    @Test
    fun `should throw error when changing to empty name`() {
        val user = createTestUser()

        assertThrows<InvalidUserNameError> {
            user.changeName("")
        }
        
        assertThrows<InvalidUserNameError> {
            user.changeName("   ")
        }
    }

    @Test
    fun `should deactivate user correctly`() {
        val user = createTestUser()
        
        val deactivatedUser = user.deactivate()
        
        assertEquals(UserStatus.INACTIVE, deactivatedUser.status)
        assertEquals(UserStatus.ACTIVE, user.status) // 元のインスタンスは変更されない
    }

    @Test
    fun `should not allow profile update for inactive user`() {
        val user = createTestUser().deactivate()
        
        assertFalse(user.canUpdateProfile())
    }

    private fun createTestUser(): User {
        return User.create(
            UserId.create("user-123"),
            Email.create("test@example.com"),
            "Test User"
        )
    }
}
```

## まとめ

この実装例は以下の原則に従います：

1. **純粋関数**: ドメイン層のメソッドは副作用なし
2. **イミュータビリティ**: エンティティは状態変更時に新しいインスタンスを返す
3. **副作用の分離**: データベース操作等の副作用は Infrastructure 層に集約
4. **テスタビリティ**: 純粋関数により単体テストが容易
5. **依存関係の逆転**: ドメイン層がインフラ層に依存しない設計