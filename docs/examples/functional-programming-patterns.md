# 関数型プログラミング パターン集

## 概要

本ドキュメントは、Kotlinを使用したバックエンド開発における関数型プログラミングの具体的なパターンとコード例を提供します。
副作用を最小限に抑え、純粋関数を中心とした実装パターンを示します。

## 基本パターン

### 1. 純粋関数（Pure Functions）

```kotlin
// ❌ 副作用のある関数（避けるべき）
class Calculator {
    private var result: Int = 0

    fun add(value: Int) {
        result += value // 状態変更（副作用）
        println("Result: $result") // ログ出力（副作用）
    }
}

// ✅ 純粋関数による実装
object Calculator {
    fun add(a: Int, b: Int): Int {
        return a + b // 同じ入力に対して常に同じ出力
    }

    fun multiply(numbers: List<Int>): Int {
        return numbers.fold(1) { acc, num -> acc * num }
    }

    fun calculateTax(price: Double, taxRate: Double): Double {
        require(price >= 0 && taxRate >= 0) {
            "Price and tax rate must be non-negative"
        }
        return price * taxRate
    }
}
```

### 2. イミュータブルなデータ構造

```kotlin
// ❌ ミュータブルな実装（避けるべき）
class ShoppingCart {
    private val items: MutableList<CartItem> = mutableListOf()

    fun addItem(item: CartItem) {
        items.add(item) // 既存リストを変更
    }

    fun removeItem(itemId: String) {
        items.removeIf { it.id == itemId } // 既存リストを変更
    }
}

// ✅ イミュータブルな実装
data class ShoppingCart private constructor(
    private val items: List<CartItem>
) {
    companion object {
        fun empty(): ShoppingCart {
            return ShoppingCart(emptyList())
        }

        fun create(items: List<CartItem>): ShoppingCart {
            return ShoppingCart(items.toList()) // 防御的コピー
        }
    }

    fun addItem(item: CartItem): ShoppingCart {
        return ShoppingCart(items + item) // 新しいインスタンス
    }

    fun removeItem(itemId: String): ShoppingCart {
        val newItems = items.filter { it.id != itemId }
        return ShoppingCart(newItems)
    }

    fun updateItemQuantity(itemId: String, quantity: Int): ShoppingCart {
        val newItems = items.map { item ->
            if (item.id == itemId) {
                item.copy(quantity = quantity)
            } else {
                item
            }
        }
        return ShoppingCart(newItems)
    }

    fun getItems(): List<CartItem> {
        return items.toList() // 不変コピーを返す
    }

    fun getTotalPrice(): Double {
        return items.sumOf { it.getTotalPrice() }
    }

    fun getItemCount(): Int {
        return items.sumOf { it.quantity }
    }
}

data class CartItem(
    val id: String,
    val name: String,
    val price: Double,
    val quantity: Int
) {
    fun getTotalPrice(): Double {
        return price * quantity
    }
}
```

### 3. 関数合成（Function Composition）

```kotlin
// 基本的な関数合成
typealias TransformFunction<T, U> = (T) -> U

object FunctionComposer {
    fun <T, U, V> compose(
        f: TransformFunction<U, V>,
        g: TransformFunction<T, U>
    ): TransformFunction<T, V> {
        return { input: T -> f(g(input)) }
    }

    fun <T> pipe(vararg functions: TransformFunction<T, T>): TransformFunction<T, T> {
        return functions.fold({ it }) { composed, fn ->
            { input: T -> fn(composed(input)) }
        }
    }
}

// 実用例：データ変換パイプライン
data class UserData(
    val firstName: String,
    val lastName: String,
    val email: String,
    val age: Int
)

data class ProcessedUser(
    val fullName: String,
    val email: String,
    val isAdult: Boolean,
    val displayName: String
)

object UserProcessor {
    private fun normalizeEmail(user: UserData): UserData {
        return user.copy(
            email = user.email.lowercase().trim()
        )
    }

    private fun validateAge(user: UserData): UserData {
        require(user.age in 0..150) {
            "Invalid age: ${user.age}"
        }
        return user
    }

    private fun toProcessedUser(user: UserData): ProcessedUser {
        return ProcessedUser(
            fullName = "${user.firstName} ${user.lastName}",
            email = user.email,
            isAdult = user.age >= 18,
            displayName = user.firstName
        )
    }

    fun processUser(userData: UserData): ProcessedUser {
        val pipeline = FunctionComposer.compose(
            ::toProcessedUser,
            FunctionComposer.compose(
                ::validateAge,
                ::normalizeEmail
            )
        )

        return pipeline(userData)
    }

    // 複数ユーザーの処理
    fun processUsers(users: List<UserData>): List<ProcessedUser> {
        return users.map(::processUser)
    }
}
```

### 4. 高階関数（Higher-Order Functions）

```kotlin
// フィルタリング・変換・集約の関数型パターン
object DataProcessor {
    // 条件に基づくフィルタリング
    fun <T> filterBy(
        items: List<T>,
        predicate: (T) -> Boolean
    ): List<T> {
        return items.filter(predicate)
    }

    // データ変換
    fun <T, U> transformBy(
        items: List<T>,
        transformer: (T) -> U
    ): List<U> {
        return items.map(transformer)
    }

    // 集約処理
    fun <T, U> reduceBy(
        items: List<T>,
        reducer: (acc: U, item: T) -> U,
        initialValue: U
    ): U {
        return items.fold(initialValue, reducer)
    }

    // 複合処理
    fun <T, U> process(
        items: List<T>,
        operations: ProcessOperations<T, U>
    ): List<U> {
        var result = items.asSequence()

        operations.filter?.let { filter ->
            result = result.filter(filter)
        }

        val transformed = operations.transform?.let { transform ->
            result.map(transform)
        } ?: result.map { it as U }

        val finalResult = transformed.toList()

        return operations.sort?.let { sort ->
            finalResult.sortedWith(sort)
        } ?: finalResult
    }
}

data class ProcessOperations<T, U>(
    val filter: ((T) -> Boolean)? = null,
    val transform: ((T) -> U)? = null,
    val sort: (Comparator<U>)? = null
)

// 使用例
data class Product(
    val id: String,
    val name: String,
    val price: Double,
    val category: String,
    val inStock: Boolean
)

data class ProductSummary(
    val name: String,
    val formattedPrice: String
)

object ProductService {
    fun getAvailableProductSummaries(products: List<Product>): List<ProductSummary> {
        return DataProcessor.process(
            items = products,
            operations = ProcessOperations(
                filter = { product -> product.inStock && product.price > 0 },
                transform = { product ->
                    ProductSummary(
                        name = product.name,
                        formattedPrice = "$%.2f".format(product.price)
                    )
                },
                sort = compareBy { it.name }
            )
        )
    }

    fun calculateCategoryTotals(products: List<Product>): Map<String, Double> {
        return products
            .filter { it.inStock }
            .groupBy { it.category }
            .mapValues { (_, products) -> products.sumOf { it.price } }
    }
}
```

### 5. Option/Maybe パターン

```kotlin
// Null安全な値の処理
sealed class Option<out T> {
    data class Some<T>(val value: T) : Option<T>()
    object None : Option<Nothing>()

    companion object {
        fun <T> some(value: T): Option<T> {
            return Some(value)
        }

        fun <T> none(): Option<T> {
            return None
        }

        fun <T> fromNullable(value: T?): Option<T> {
            return if (value != null) some(value) else none()
        }
    }

    fun isSome(): Boolean = this is Some
    fun isNone(): Boolean = this is None

    inline fun <U> map(mapper: (T) -> U): Option<U> {
        return when (this) {
            is Some -> some(mapper(value))
            is None -> none()
        }
    }

    inline fun <U> flatMap(mapper: (T) -> Option<U>): Option<U> {
        return when (this) {
            is Some -> mapper(value)
            is None -> none()
        }
    }

    inline fun filter(predicate: (T) -> Boolean): Option<T> {
        return when (this) {
            is Some -> if (predicate(value)) this else none()
            is None -> this
        }
    }

    fun getOrElse(defaultValue: T): T {
        return when (this) {
            is Some -> value
            is None -> defaultValue
        }
    }

    fun getOrThrow(errorMessage: String = "Option is None"): T {
        return when (this) {
            is Some -> value
            is None -> throw IllegalStateException(errorMessage)
        }
    }
}

// 使用例
class UserService {
    private val users: Map<String, User> = mapOf()

    fun findUserById(id: String): Option<User> {
        val user = users[id]
        return Option.fromNullable(user)
    }

    fun getUserEmail(userId: String): Option<String> {
        return findUserById(userId)
            .map { user -> user.email.value }
    }

    fun getActiveUserEmail(userId: String): Option<String> {
        return findUserById(userId)
            .filter { user -> user.status == UserStatus.ACTIVE }
            .map { user -> user.email.value }
    }

    fun getUserDisplayName(userId: String): String {
        return findUserById(userId)
            .map { user -> user.name }
            .getOrElse("Unknown User")
    }
}
```

### 6. Result/Either パターン（エラーハンドリング）

```kotlin
// 成功/失敗を表現する型安全なパターン
sealed class Result<out T, out E> {
    data class Success<T>(val value: T) : Result<T, Nothing>()
    data class Failure<E>(val error: E) : Result<Nothing, E>()

    companion object {
        fun <T> success(value: T): Result<T, Nothing> = Success(value)
        fun <E> failure(error: E): Result<Nothing, E> = Failure(error)
    }

    fun isSuccess(): Boolean = this is Success
    fun isFailure(): Boolean = this is Failure

    inline fun <U> map(mapper: (T) -> U): Result<U, E> {
        return when (this) {
            is Success -> success(mapper(value))
            is Failure -> this
        }
    }

    inline fun <U> flatMap(mapper: (T) -> Result<U, E>): Result<U, E> {
        return when (this) {
            is Success -> mapper(value)
            is Failure -> this
        }
    }

    inline fun <F> mapError(mapper: (E) -> F): Result<T, F> {
        return when (this) {
            is Success -> this
            is Failure -> failure(mapper(error))
        }
    }

    fun getOrThrow(): T {
        return when (this) {
            is Success -> value
            is Failure -> throw IllegalStateException("Result is failure: $error")
        }
    }

    fun getOrElse(defaultValue: T): T {
        return when (this) {
            is Success -> value
            is Failure -> defaultValue
        }
    }
}

// 使用例：バリデーション
data class ValidationError(
    val field: String,
    val message: String
)

object Validator {
    private val EMAIL_REGEX = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun validateEmail(email: String): Result<String, ValidationError> {
        if (email.isBlank()) {
            return Result.failure(
                ValidationError("email", "Email is required")
            )
        }

        if (!EMAIL_REGEX.matches(email)) {
            return Result.failure(
                ValidationError("email", "Invalid email format")
            )
        }

        return Result.success(email.lowercase().trim())
    }

    fun validateAge(age: Int): Result<Int, ValidationError> {
        if (age < 0) {
            return Result.failure(
                ValidationError("age", "Age cannot be negative")
            )
        }

        if (age > 150) {
            return Result.failure(
                ValidationError("age", "Age seems unrealistic")
            )
        }

        return Result.success(age)
    }

    fun validateUserData(data: UserValidationData): Result<ValidatedUserData, List<ValidationError>> {
        val emailResult = validateEmail(data.email)
        val ageResult = validateAge(data.age)

        val errors = mutableListOf<ValidationError>()
        
        if (emailResult.isFailure()) {
            errors.add((emailResult as Result.Failure).error)
        }
        
        if (ageResult.isFailure()) {
            errors.add((ageResult as Result.Failure).error)
        }

        if (errors.isNotEmpty()) {
            return Result.failure(errors)
        }

        return Result.success(
            ValidatedUserData(
                email = emailResult.getOrThrow(),
                age = ageResult.getOrThrow()
            )
        )
    }
}

data class UserValidationData(
    val email: String,
    val age: Int
)

data class ValidatedUserData(
    val email: String,
    val age: Int
)
```

### 7. パイプライン処理パターン

```kotlin
// 複数のステップを組み合わせた処理パイプライン
class Pipeline<T> private constructor(private val value: T) {
    companion object {
        fun <T> start(value: T): Pipeline<T> {
            return Pipeline(value)
        }
    }

    fun <U> pipe(transform: (T) -> U): Pipeline<U> {
        return Pipeline(transform(value))
    }

    suspend fun <U> pipeAsync(transform: suspend (T) -> U): Pipeline<U> {
        val result = transform(value)
        return Pipeline(result)
    }

    fun filter(predicate: (T) -> Boolean): Pipeline<T?> {
        return Pipeline(if (predicate(value)) value else null)
    }

    fun tap(sideEffect: (T) -> Unit): Pipeline<T> {
        sideEffect(value)
        return this
    }

    fun getValue(): T {
        return value
    }
}

// 使用例：注文処理パイプライン
data class Order(
    val id: String,
    val customerId: String,
    val items: List<OrderItem>,
    val status: OrderStatus,
    val totalAmount: Double
)

data class OrderItem(
    val productId: String,
    val quantity: Int,
    val price: Double
)

enum class OrderStatus {
    PENDING,
    VALIDATED,
    PAID,
    SHIPPED
}

object OrderProcessor {
    fun processOrder(order: Order): Order {
        return Pipeline.start(order)
            .pipe(::validateOrder)
            .pipe(::calculateTotal)
            .pipe(::applyDiscounts)
            .tap { processedOrder ->
                println("Processing order ${processedOrder.id}")
            }
            .getValue()
    }

    private fun validateOrder(order: Order): Order {
        require(order.items.isNotEmpty()) {
            "Order must have at least one item"
        }

        require(order.items.all { it.quantity > 0 }) {
            "All items must have positive quantity"
        }

        return order.copy(status = OrderStatus.VALIDATED)
    }

    private fun calculateTotal(order: Order): Order {
        val totalAmount = order.items.sumOf { item ->
            item.price * item.quantity
        }

        return order.copy(totalAmount = totalAmount)
    }

    private fun applyDiscounts(order: Order): Order {
        var discountRate = 0.0

        // 数量割引
        val totalItems = order.items.sumOf { it.quantity }
        if (totalItems >= 10) {
            discountRate = 0.1 // 10%割引
        }

        // 金額割引
        if (order.totalAmount >= 1000) {
            discountRate = maxOf(discountRate, 0.05) // 5%割引
        }

        val discountedAmount = order.totalAmount * (1 - discountRate)

        return order.copy(totalAmount = discountedAmount)
    }
}
```

## 実践的な組み合わせ例

```kotlin
// 複数の関数型パターンを組み合わせたユースケース実装
class FunctionalUserService(
    private val userRepository: UserRepository
) {
    suspend fun updateUserProfile(
        userId: String,
        updates: UserProfileUpdates
    ): Result<User, List<String>> {
        // バリデーション結果の収集
        val validationResults = validateUpdates(updates)
        
        if (validationResults.isFailure()) {
            return validationResults
        }

        // ユーザー取得と更新処理
        val userOption = findUserById(userId)
        
        return when (userOption) {
            is Option.Some -> {
                val updatedUser = Pipeline.start(userOption.value)
                    .pipe { user ->
                        updates.name?.let { user.changeName(it) } ?: user
                    }
                    .pipe { user ->
                        updates.email?.let { 
                            user.copy(email = Email.create(it))
                        } ?: user
                    }
                    .getValue()
                
                saveUser(updatedUser)
            }
            is Option.None -> {
                Result.failure(listOf("User not found"))
            }
        }
    }

    private suspend fun validateUpdates(
        updates: UserProfileUpdates
    ): Result<Unit, List<String>> {
        val errors = mutableListOf<String>()

        updates.name?.let { name ->
            val nameValidation = validateName(name)
            if (nameValidation.isFailure()) {
                errors.add((nameValidation as Result.Failure).error)
            }
        }

        updates.email?.let { email ->
            val emailValidation = validateEmailUniqueness(email)
            if (emailValidation.isFailure()) {
                errors.add((emailValidation as Result.Failure).error)
            }
        }

        return if (errors.isNotEmpty()) {
            Result.failure(errors)
        } else {
            Result.success(Unit)
        }
    }

    private fun validateName(name: String): Result<String, String> {
        return when {
            name.isBlank() -> Result.failure("Name cannot be empty")
            name.length > 100 -> Result.failure("Name is too long")
            else -> Result.success(name.trim())
        }
    }

    private suspend fun validateEmailUniqueness(email: String): Result<String, String> {
        return try {
            val emailObj = Email.create(email)
            val existingUser = userRepository.findByEmail(emailObj)
            
            if (existingUser != null) {
                Result.failure("Email already exists")
            } else {
                Result.success(email)
            }
        } catch (error: Exception) {
            Result.failure("Invalid email format")
        }
    }

    private suspend fun findUserById(userId: String): Option<User> {
        return try {
            val id = UserId.create(userId)
            val user = userRepository.findById(id)
            Option.fromNullable(user)
        } catch (error: Exception) {
            Option.none()
        }
    }

    private suspend fun saveUser(user: User): Result<User, List<String>> {
        return try {
            userRepository.save(user)
            Result.success(user)
        } catch (error: Exception) {
            Result.failure(listOf("Failed to save user"))
        }
    }
}

data class UserProfileUpdates(
    val name: String? = null,
    val email: String? = null
)
```

## まとめ

これらの関数型プログラミングパターンにより：

1. **副作用の制御**: 副作用を特定の境界に制限
2. **テスタビリティ**: 純粋関数により単体テストが容易
3. **コードの予測可能性**: 同じ入力に対して常に同じ出力
4. **コンポーザビリティ**: 小さな関数を組み合わせて複雑な処理を構築
5. **エラーハンドリング**: 型安全なエラーハンドリング
6. **データの不変性**: 意図しない状態変更を防止