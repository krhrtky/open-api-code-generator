# TypeScript API Client 生成とコード例

## 概要

このドキュメントでは、OpenAPIスキーマからTypeScript API Clientを生成する方法と、生成されたクライアントの使用例を詳細に説明します。型安全で使いやすいAPIクライアントの実装パターンを提供します。

## 生成されるTypeScript API Client

### 1. 基本構造

```typescript
// 生成されるファイル構造
src/
├── api/
│   ├── apis/
│   │   └── UsersApi.ts           // API操作クラス
│   ├── models/
│   │   ├── User.ts               // エンティティ型
│   │   ├── CreateUserRequest.ts  // リクエスト型
│   │   ├── UserListResponse.ts   // レスポンス型
│   │   └── index.ts              // 型エクスポート
│   ├── runtime.ts                // 基盤クラス
│   └── index.ts                  // 全体エクスポート
```

### 2. 型定義ファイル

#### User エンティティ型

```typescript
/**
 * ユーザー情報
 * @export
 * @interface User
 */
export interface User {
    /**
     * ユーザーの一意識別子
     * @type {number}
     * @memberof User
     */
    id: number;
    /**
     * ユーザー名（英数字とアンダースコアのみ）
     * @type {string}
     * @memberof User
     */
    username: string;
    /**
     * メールアドレス
     * @type {string}
     * @memberof User
     */
    email: string;
    /**
     * 名前
     * @type {string}
     * @memberof User
     */
    firstName?: string;
    /**
     * 姓
     * @type {string}
     * @memberof User
     */
    lastName?: string;
    /**
     * 年齢
     * @type {number}
     * @memberof User
     */
    age?: number;
    /**
     * ユーザーのステータス
     * @type {UserStatus}
     * @memberof User
     */
    status?: UserStatus;
    /**
     * 作成日時
     * @type {string}
     * @memberof User
     */
    createdAt: string;
    /**
     * 更新日時
     * @type {string}
     * @memberof User
     */
    updatedAt: string;
}

/**
 * ユーザーのステータス
 * @export
 * @enum {string}
 */
export enum UserStatus {
    Active = 'active',
    Inactive = 'inactive',
    Suspended = 'suspended'
}

/**
 * ユーザー作成リクエスト
 * @export
 * @interface CreateUserRequest
 */
export interface CreateUserRequest {
    /**
     * ユーザー名
     * @type {string}
     * @memberof CreateUserRequest
     */
    username: string;
    /**
     * メールアドレス
     * @type {string}
     * @memberof CreateUserRequest
     */
    email: string;
    /**
     * 名前
     * @type {string}
     * @memberof CreateUserRequest
     */
    firstName: string;
    /**
     * 姓
     * @type {string}
     * @memberof CreateUserRequest
     */
    lastName: string;
    /**
     * 年齢
     * @type {number}
     * @memberof CreateUserRequest
     */
    age?: number;
}

/**
 * ユーザー更新リクエスト
 * @export
 * @interface UpdateUserRequest
 */
export interface UpdateUserRequest {
    /**
     * 名前
     * @type {string}
     * @memberof UpdateUserRequest
     */
    firstName?: string;
    /**
     * 姓
     * @type {string}
     * @memberof UpdateUserRequest
     */
    lastName?: string;
    /**
     * 年齢
     * @type {number}
     * @memberof UpdateUserRequest
     */
    age?: number;
    /**
     * ユーザーのステータス
     * @type {UserStatus}
     * @memberof UpdateUserRequest
     */
    status?: UserStatus;
}

/**
 * ページネーション情報
 * @export
 * @interface PaginationInfo
 */
export interface PaginationInfo {
    /**
     * 現在のページ番号（0から開始）
     * @type {number}
     * @memberof PaginationInfo
     */
    page: number;
    /**
     * ページサイズ
     * @type {number}
     * @memberof PaginationInfo
     */
    size: number;
    /**
     * 総要素数
     * @type {number}
     * @memberof PaginationInfo
     */
    totalElements: number;
    /**
     * 総ページ数
     * @type {number}
     * @memberof PaginationInfo
     */
    totalPages: number;
}

/**
 * ユーザー一覧レスポンス
 * @export
 * @interface UserListResponse
 */
export interface UserListResponse {
    /**
     * ユーザー一覧
     * @type {Array<User>}
     * @memberof UserListResponse
     */
    users: Array<User>;
    /**
     * ページネーション情報
     * @type {PaginationInfo}
     * @memberof UserListResponse
     */
    pagination: PaginationInfo;
}

/**
 * エラー詳細情報
 * @export
 * @interface ErrorDetail
 */
export interface ErrorDetail {
    /**
     * エラーが発生したフィールド
     * @type {string}
     * @memberof ErrorDetail
     */
    field: string;
    /**
     * フィールド固有のエラーコード
     * @type {string}
     * @memberof ErrorDetail
     */
    code: string;
    /**
     * フィールド固有のエラーメッセージ
     * @type {string}
     * @memberof ErrorDetail
     */
    message: string;
    /**
     * 拒否された値
     * @type {any}
     * @memberof ErrorDetail
     */
    rejectedValue?: any;
}

/**
 * エラーレスポンス
 * @export
 * @interface ErrorResponse
 */
export interface ErrorResponse {
    /**
     * エラーコード（機械可読）
     * @type {string}
     * @memberof ErrorResponse
     */
    error: string;
    /**
     * エラーメッセージ（人間可読）
     * @type {string}
     * @memberof ErrorResponse
     */
    message: string;
    /**
     * 詳細なエラー情報
     * @type {Array<ErrorDetail>}
     * @memberof ErrorDetail
     */
    details?: Array<ErrorDetail>;
    /**
     * エラー発生日時
     * @type {string}
     * @memberof ErrorResponse
     */
    timestamp: string;
    /**
     * トレースID（デバッグ用）
     * @type {string}
     * @memberof ErrorResponse
     */
    traceId?: string;
}
```

### 3. APIクライアントクラス

```typescript
import { Configuration } from '../runtime';
import {
    User,
    CreateUserRequest,
    UpdateUserRequest,
    UserListResponse,
    UserStatus,
    ErrorResponse
} from '../models';

/**
 * ユーザー管理API操作のパラメータ型定義
 */
export interface GetUsersRequest {
    /**
     * ページ番号（0から開始）
     * @type {number}
     * @memberof GetUsersRequest
     */
    page?: number;
    /**
     * ページサイズ
     * @type {number}
     * @memberof GetUsersRequest
     */
    size?: number;
    /**
     * ステータスでフィルタ
     * @type {UserStatus}
     * @memberof GetUsersRequest
     */
    status?: UserStatus;
    /**
     * ユーザー名または名前で検索
     * @type {string}
     * @memberof GetUsersRequest
     */
    search?: string;
}

export interface GetUserByIdRequest {
    /**
     * ユーザーID
     * @type {number}
     * @memberof GetUserByIdRequest
     */
    userId: number;
}

export interface CreateUserOperationRequest {
    /**
     * ユーザー作成リクエスト
     * @type {CreateUserRequest}
     * @memberof CreateUserOperationRequest
     */
    createUserRequest: CreateUserRequest;
}

export interface UpdateUserOperationRequest {
    /**
     * ユーザーID
     * @type {number}
     * @memberof UpdateUserOperationRequest
     */
    userId: number;
    /**
     * ユーザー更新リクエスト
     * @type {UpdateUserRequest}
     * @memberof UpdateUserOperationRequest
     */
    updateUserRequest: UpdateUserRequest;
}

export interface DeleteUserRequest {
    /**
     * ユーザーID
     * @type {number}
     * @memberof DeleteUserRequest
     */
    userId: number;
}

/**
 * UsersApi - object-oriented interface
 * @export
 * @class UsersApi
 * @extends {BaseAPI}
 */
export class UsersApi extends BaseAPI {

    /**
     * ユーザー一覧取得
     * 条件に基づいてユーザー一覧を取得します
     * @summary ユーザー一覧取得
     * @param {GetUsersRequest} [requestParameters] Request parameters.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof UsersApi
     */
    public async getUsers(
        requestParameters: GetUsersRequest = {},
        options?: any
    ): Promise<UserListResponse> {
        const localVarRequestOptions = { 
            method: 'GET' as Method,
            ...options,
        };

        const localVarHeaderParameter = {} as any;
        const localVarQueryParameter = {} as any;

        // Set authentication headers
        await this.setAuthentication(localVarHeaderParameter);

        // Build query parameters
        if (requestParameters.page !== undefined) {
            localVarQueryParameter['page'] = requestParameters.page;
        }

        if (requestParameters.size !== undefined) {
            localVarQueryParameter['size'] = requestParameters.size;
        }

        if (requestParameters.status !== undefined) {
            localVarQueryParameter['status'] = requestParameters.status;
        }

        if (requestParameters.search !== undefined) {
            localVarQueryParameter['search'] = requestParameters.search;
        }

        localVarRequestOptions.headers = {
            ...localVarHeaderParameter,
            ...localVarRequestOptions.headers,
        };

        const localVarUrlObj = new URL('/api/v1/users', this.configuration.basePath);
        
        // Add query parameters
        Object.keys(localVarQueryParameter).forEach(key => {
            if (localVarQueryParameter[key] !== undefined) {
                localVarUrlObj.searchParams.set(key, localVarQueryParameter[key]);
            }
        });

        const response = await this.request(localVarUrlObj.toString(), localVarRequestOptions);
        
        if (!response.ok) {
            throw await this.handleErrorResponse(response);
        }

        return await response.json() as UserListResponse;
    }

    /**
     * ユーザー作成
     * 新しいユーザーを作成します
     * @summary ユーザー作成
     * @param {CreateUserOperationRequest} requestParameters Request parameters.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof UsersApi
     */
    public async createUser(
        requestParameters: CreateUserOperationRequest,
        options?: any
    ): Promise<User> {
        if (requestParameters.createUserRequest === null || requestParameters.createUserRequest === undefined) {
            throw new RequiredError('createUserRequest','Required parameter requestParameters.createUserRequest was null or undefined when calling createUser.');
        }

        const localVarRequestOptions = { 
            method: 'POST' as Method,
            ...options,
        };

        const localVarHeaderParameter = {} as any;

        // Set authentication headers
        await this.setAuthentication(localVarHeaderParameter);

        // Set content type
        localVarHeaderParameter['Content-Type'] = 'application/json';

        localVarRequestOptions.headers = {
            ...localVarHeaderParameter,
            ...localVarRequestOptions.headers,
        };

        localVarRequestOptions.body = JSON.stringify(requestParameters.createUserRequest);

        const localVarUrlObj = new URL('/api/v1/users', this.configuration.basePath);

        const response = await this.request(localVarUrlObj.toString(), localVarRequestOptions);
        
        if (!response.ok) {
            throw await this.handleErrorResponse(response);
        }

        return await response.json() as User;
    }

    /**
     * ユーザー詳細取得
     * 指定されたIDのユーザー詳細を取得します
     * @summary ユーザー詳細取得
     * @param {GetUserByIdRequest} requestParameters Request parameters.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof UsersApi
     */
    public async getUserById(
        requestParameters: GetUserByIdRequest,
        options?: any
    ): Promise<User> {
        if (requestParameters.userId === null || requestParameters.userId === undefined) {
            throw new RequiredError('userId','Required parameter requestParameters.userId was null or undefined when calling getUserById.');
        }

        const localVarRequestOptions = { 
            method: 'GET' as Method,
            ...options,
        };

        const localVarHeaderParameter = {} as any;

        // Set authentication headers
        await this.setAuthentication(localVarHeaderParameter);

        localVarRequestOptions.headers = {
            ...localVarHeaderParameter,
            ...localVarRequestOptions.headers,
        };

        const localVarUrlObj = new URL(
            `/api/v1/users/${encodeURIComponent(String(requestParameters.userId))}`, 
            this.configuration.basePath
        );

        const response = await this.request(localVarUrlObj.toString(), localVarRequestOptions);
        
        if (!response.ok) {
            throw await this.handleErrorResponse(response);
        }

        return await response.json() as User;
    }

    /**
     * ユーザー更新
     * 指定されたIDのユーザー情報を更新します
     * @summary ユーザー更新
     * @param {UpdateUserOperationRequest} requestParameters Request parameters.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof UsersApi
     */
    public async updateUser(
        requestParameters: UpdateUserOperationRequest,
        options?: any
    ): Promise<User> {
        if (requestParameters.userId === null || requestParameters.userId === undefined) {
            throw new RequiredError('userId','Required parameter requestParameters.userId was null or undefined when calling updateUser.');
        }

        if (requestParameters.updateUserRequest === null || requestParameters.updateUserRequest === undefined) {
            throw new RequiredError('updateUserRequest','Required parameter requestParameters.updateUserRequest was null or undefined when calling updateUser.');
        }

        const localVarRequestOptions = { 
            method: 'PUT' as Method,
            ...options,
        };

        const localVarHeaderParameter = {} as any;

        // Set authentication headers
        await this.setAuthentication(localVarHeaderParameter);

        // Set content type
        localVarHeaderParameter['Content-Type'] = 'application/json';

        localVarRequestOptions.headers = {
            ...localVarHeaderParameter,
            ...localVarRequestOptions.headers,
        };

        localVarRequestOptions.body = JSON.stringify(requestParameters.updateUserRequest);

        const localVarUrlObj = new URL(
            `/api/v1/users/${encodeURIComponent(String(requestParameters.userId))}`, 
            this.configuration.basePath
        );

        const response = await this.request(localVarUrlObj.toString(), localVarRequestOptions);
        
        if (!response.ok) {
            throw await this.handleErrorResponse(response);
        }

        return await response.json() as User;
    }

    /**
     * ユーザー削除
     * 指定されたIDのユーザーを削除します
     * @summary ユーザー削除
     * @param {DeleteUserRequest} requestParameters Request parameters.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof UsersApi
     */
    public async deleteUser(
        requestParameters: DeleteUserRequest,
        options?: any
    ): Promise<void> {
        if (requestParameters.userId === null || requestParameters.userId === undefined) {
            throw new RequiredError('userId','Required parameter requestParameters.userId was null or undefined when calling deleteUser.');
        }

        const localVarRequestOptions = { 
            method: 'DELETE' as Method,
            ...options,
        };

        const localVarHeaderParameter = {} as any;

        // Set authentication headers
        await this.setAuthentication(localVarHeaderParameter);

        localVarRequestOptions.headers = {
            ...localVarHeaderParameter,
            ...localVarRequestOptions.headers,
        };

        const localVarUrlObj = new URL(
            `/api/v1/users/${encodeURIComponent(String(requestParameters.userId))}`, 
            this.configuration.basePath
        );

        const response = await this.request(localVarUrlObj.toString(), localVarRequestOptions);
        
        if (!response.ok) {
            throw await this.handleErrorResponse(response);
        }

        // 204 No Content - no response body expected
        return;
    }
}
```

### 4. 基盤クラス (BaseAPI)

```typescript
import { Configuration } from './configuration';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * 必須パラメータエラー
 * @export
 * @class RequiredError
 * @extends {Error}
 */
export class RequiredError extends Error {
    name: "RequiredError" = "RequiredError";
    constructor(public field: string, msg?: string) {
        super(msg);
    }
}

/**
 * APIエラーレスポンス
 * @export
 * @class ApiError
 * @extends {Error}
 */
export class ApiError extends Error {
    name: "ApiError" = "ApiError";
    
    constructor(
        public response: Response,
        public body?: ErrorResponse,
        message?: string
    ) {
        super(message || `API Error: ${response.status} ${response.statusText}`);
    }
}

/**
 * Base API class
 * @export
 * @class BaseAPI
 */
export class BaseAPI {
    protected configuration: Configuration;

    constructor(configuration: Configuration = new Configuration()) {
        this.configuration = configuration;
    }

    /**
     * HTTP リクエストを実行
     * @protected
     * @param {string} url
     * @param {RequestInit} options
     * @returns {Promise<Response>}
     * @memberof BaseAPI
     */
    protected async request(url: string, options: RequestInit): Promise<Response> {
        // 認証情報を設定
        if (this.configuration.accessToken) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${this.configuration.accessToken}`
            };
        }

        if (this.configuration.apiKey) {
            options.headers = {
                ...options.headers,
                'X-API-Key': this.configuration.apiKey
            };
        }

        // デフォルトヘッダーを設定
        options.headers = {
            'Accept': 'application/json',
            ...this.configuration.defaultHeaders,
            ...options.headers,
        };

        // リクエストを実行
        const response = await this.configuration.fetchApi(url, options);
        
        return response;
    }

    /**
     * 認証ヘッダーを設定
     * @protected
     * @param {any} headers
     * @memberof BaseAPI
     */
    protected async setAuthentication(headers: any): Promise<void> {
        if (this.configuration.accessToken) {
            const token = typeof this.configuration.accessToken === 'function'
                ? await this.configuration.accessToken()
                : this.configuration.accessToken;
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (this.configuration.apiKey) {
            const apiKey = typeof this.configuration.apiKey === 'function'
                ? await this.configuration.apiKey()
                : this.configuration.apiKey;
            headers['X-API-Key'] = apiKey;
        }
    }

    /**
     * エラーレスポンスを処理
     * @protected
     * @param {Response} response
     * @returns {Promise<ApiError>}
     * @memberof BaseAPI
     */
    protected async handleErrorResponse(response: Response): Promise<ApiError> {
        let errorBody: ErrorResponse | undefined;
        
        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                errorBody = await response.json() as ErrorResponse;
            }
        } catch (e) {
            // JSON パースエラーを無視
        }

        return new ApiError(response, errorBody);
    }
}
```

### 5. 設定クラス

```typescript
/**
 * API設定クラス
 * @export
 * @class Configuration
 */
export class Configuration {
    /**
     * APIのベースURL
     * @type {string}
     * @memberof Configuration
     */
    basePath: string;

    /**
     * Bearer トークン
     * @type {string | (() => string | Promise<string>)}
     * @memberof Configuration
     */
    accessToken?: string | (() => string | Promise<string>);

    /**
     * APIキー
     * @type {string | (() => string | Promise<string>)}
     * @memberof Configuration
     */
    apiKey?: string | (() => string | Promise<string>);

    /**
     * デフォルトヘッダー
     * @type {Record<string, string>}
     * @memberof Configuration
     */
    defaultHeaders?: Record<string, string>;

    /**
     * Fetch API 実装
     * @type {(url: string, init?: RequestInit) => Promise<Response>}
     * @memberof Configuration
     */
    fetchApi: (url: string, init?: RequestInit) => Promise<Response>;

    constructor(configuration: Partial<Configuration> = {}) {
        this.basePath = configuration.basePath || 'https://api.example.com/v1';
        this.accessToken = configuration.accessToken;
        this.apiKey = configuration.apiKey;
        this.defaultHeaders = configuration.defaultHeaders || {};
        this.fetchApi = configuration.fetchApi || 
            (typeof window !== 'undefined' && window.fetch) || 
            require('node-fetch');
    }
}
```

## 使用例

### 1. 基本的な使用方法

```typescript
import { Configuration, UsersApi } from './generated-api';

// API設定
const config = new Configuration({
    basePath: 'https://api.example.com/v1',
    accessToken: 'your-jwt-token-here',
    defaultHeaders: {
        'Content-Type': 'application/json',
    }
});

// APIクライアントのインスタンス化
const usersApi = new UsersApi(config);

// ユーザー一覧取得の例
async function getUserList() {
    try {
        const userList = await usersApi.getUsers({
            page: 0,
            size: 20,
            status: UserStatus.Active
        });

        console.log('取得したユーザー数:', userList.users.length);
        console.log('総ユーザー数:', userList.pagination.totalElements);
        
        return userList;
    } catch (error) {
        if (error instanceof ApiError) {
            console.error('API Error:', error.response.status);
            if (error.body) {
                console.error('Error details:', error.body.details);
            }
        } else {
            console.error('Unexpected error:', error);
        }
        throw error;
    }
}

// ユーザー作成の例
async function createNewUser() {
    try {
        const newUser = await usersApi.createUser({
            createUserRequest: {
                username: 'john_doe',
                email: 'john@example.com',
                firstName: 'John',
                lastName: 'Doe',
                age: 30
            }
        });

        console.log('作成されたユーザー:', newUser);
        return newUser;
    } catch (error) {
        if (error instanceof ApiError && error.response.status === 409) {
            console.error('ユーザーが既に存在します');
        }
        throw error;
    }
}

// ユーザー更新の例
async function updateExistingUser(userId: number) {
    try {
        const updatedUser = await usersApi.updateUser({
            userId: userId,
            updateUserRequest: {
                age: 31,
                status: UserStatus.Active
            }
        });

        console.log('更新されたユーザー:', updatedUser);
        return updatedUser;
    } catch (error) {
        if (error instanceof ApiError && error.response.status === 404) {
            console.error('ユーザーが見つかりません');
        }
        throw error;
    }
}
```

### 2. React コンポーネントでの使用例

```typescript
import React, { useState, useEffect } from 'react';
import { UsersApi, User, UserStatus, ApiError } from '../api';

interface UserListProps {
    api: UsersApi;
}

export const UserListComponent: React.FC<UserListProps> = ({ api }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const loadUsers = async (currentPage: number = 0) => {
        setLoading(true);
        setError(null);

        try {
            const response = await api.getUsers({
                page: currentPage,
                size: 10,
                status: UserStatus.Active
            });

            setUsers(response.users);
            setTotalPages(response.pagination.totalPages);
            setPage(currentPage);
        } catch (err) {
            if (err instanceof ApiError) {
                setError(`API Error: ${err.response.status} - ${err.body?.message || err.message}`);
            } else {
                setError('予期しないエラーが発生しました');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers(0);
    }, []);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 0 && newPage < totalPages) {
            loadUsers(newPage);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!window.confirm('このユーザーを削除しますか？')) {
            return;
        }

        try {
            await api.deleteUser({ userId });
            // 現在のページを再読み込み
            await loadUsers(page);
        } catch (err) {
            if (err instanceof ApiError) {
                alert(`削除に失敗しました: ${err.body?.message || err.message}`);
            }
        }
    };

    if (loading) {
        return <div>読み込み中...</div>;
    }

    if (error) {
        return <div className="error">エラー: {error}</div>;
    }

    return (
        <div>
            <h2>ユーザー一覧</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>ユーザー名</th>
                        <th>メール</th>
                        <th>名前</th>
                        <th>ステータス</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id}>
                            <td>{user.id}</td>
                            <td>{user.username}</td>
                            <td>{user.email}</td>
                            <td>{user.firstName} {user.lastName}</td>
                            <td>{user.status}</td>
                            <td>
                                <button onClick={() => handleDeleteUser(user.id)}>
                                    削除
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="pagination">
                <button 
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0}
                >
                    前へ
                </button>
                <span>ページ {page + 1} / {totalPages}</span>
                <button 
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages - 1}
                >
                    次へ
                </button>
            </div>
        </div>
    );
};
```

### 3. Vue.js での使用例

```typescript
<template>
  <div>
    <h2>ユーザー作成</h2>
    <form @submit.prevent="submitUser">
      <div>
        <label>ユーザー名:</label>
        <input 
          v-model="form.username" 
          :class="{ error: errors.username }"
          required 
        />
        <span v-if="errors.username" class="error-message">
          {{ errors.username }}
        </span>
      </div>

      <div>
        <label>メールアドレス:</label>
        <input 
          v-model="form.email" 
          type="email"
          :class="{ error: errors.email }"
          required 
        />
        <span v-if="errors.email" class="error-message">
          {{ errors.email }}
        </span>
      </div>

      <div>
        <label>名前:</label>
        <input 
          v-model="form.firstName" 
          :class="{ error: errors.firstName }"
          required 
        />
        <span v-if="errors.firstName" class="error-message">
          {{ errors.firstName }}
        </span>
      </div>

      <div>
        <label>姓:</label>
        <input 
          v-model="form.lastName" 
          :class="{ error: errors.lastName }"
          required 
        />
        <span v-if="errors.lastName" class="error-message">
          {{ errors.lastName }}
        </span>
      </div>

      <div>
        <label>年齢:</label>
        <input 
          v-model.number="form.age" 
          type="number"
          min="0"
          max="150"
        />
      </div>

      <button type="submit" :disabled="loading">
        {{ loading ? '作成中...' : 'ユーザー作成' }}
      </button>
    </form>

    <div v-if="successMessage" class="success">
      {{ successMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { UsersApi, CreateUserRequest, ApiError } from '../api';

interface Props {
  api: UsersApi;
}

const props = defineProps<Props>();

const form = reactive<CreateUserRequest>({
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  age: undefined
});

const errors = ref<Record<string, string>>({});
const loading = ref(false);
const successMessage = ref('');

const clearErrors = () => {
  errors.value = {};
  successMessage.value = '';
};

const submitUser = async () => {
  clearErrors();
  loading.value = true;

  try {
    const createdUser = await props.api.createUser({
      createUserRequest: { ...form }
    });

    successMessage.value = `ユーザー "${createdUser.username}" が作成されました！`;
    
    // フォームをリセット
    Object.assign(form, {
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      age: undefined
    });

  } catch (error) {
    if (error instanceof ApiError && error.body?.details) {
      // バリデーションエラーを個別に表示
      error.body.details.forEach(detail => {
        errors.value[detail.field] = detail.message;
      });
    } else if (error instanceof ApiError) {
      errors.value.general = error.body?.message || 'エラーが発生しました';
    } else {
      errors.value.general = '予期しないエラーが発生しました';
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.error {
  border-color: red;
}

.error-message {
  color: red;
  font-size: 0.8em;
}

.success {
  color: green;
  margin-top: 1em;
}
</style>
```

### 4. Node.js サーバーサイドでの使用例

```typescript
import express from 'express';
import { Configuration, UsersApi } from './generated-api';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// API設定（Node.js環境用）
const apiConfig = new Configuration({
    basePath: process.env.API_BASE_URL || 'https://api.example.com/v1',
    accessToken: async () => {
        // JWTトークンを動的に取得
        return await getServiceAccountToken();
    },
    fetchApi: fetch as any
});

const usersApi = new UsersApi(apiConfig);

// プロキシエンドポイント: フロントエンドからのリクエストをAPIに中継
app.get('/proxy/users', async (req, res) => {
    try {
        const { page, size, status, search } = req.query;
        
        const userList = await usersApi.getUsers({
            page: page ? parseInt(page as string) : undefined,
            size: size ? parseInt(size as string) : undefined,
            status: status as any,
            search: search as string
        });

        res.json(userList);
    } catch (error) {
        console.error('User list proxy error:', error);
        res.status(500).json({ 
            error: 'PROXY_ERROR',
            message: 'ユーザー一覧の取得に失敗しました'
        });
    }
});

// バッチ処理: 全ユーザーをCSVエクスポート
app.get('/admin/export-users', async (req, res) => {
    try {
        let allUsers: User[] = [];
        let page = 0;
        let hasMore = true;

        // 全ページを取得
        while (hasMore) {
            const response = await usersApi.getUsers({
                page: page,
                size: 100
            });

            allUsers.push(...response.users);
            page++;
            hasMore = page < response.pagination.totalPages;
        }

        // CSV形式で出力
        const csvHeader = 'ID,Username,Email,FirstName,LastName,Age,Status,CreatedAt\n';
        const csvData = allUsers.map(user => 
            `${user.id},"${user.username}","${user.email}","${user.firstName || ''}","${user.lastName || ''}",${user.age || ''},"${user.status}","${user.createdAt}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
        res.send(csvHeader + csvData);

    } catch (error) {
        console.error('Export users error:', error);
        res.status(500).json({ 
            error: 'EXPORT_ERROR',
            message: 'ユーザーエクスポートに失敗しました'
        });
    }
});

async function getServiceAccountToken(): Promise<string> {
    // サービスアカウント認証の実装
    // 実際の実装では、OAuth2フローやJWT生成を行う
    return process.env.SERVICE_ACCOUNT_TOKEN || '';
}

app.listen(3000, () => {
    console.log('Proxy server listening on port 3000');
});
```

### 5. テストコード例

```typescript
import { UsersApi, Configuration, User, UserStatus, ApiError } from '../src/api';

// モックの設定
const mockFetch = jest.fn();
const mockConfig = new Configuration({
    basePath: 'https://test-api.example.com',
    fetchApi: mockFetch
});

const usersApi = new UsersApi(mockConfig);

describe('UsersApi', () => {
    beforeEach(() => {
        mockFetch.mockClear();
    });

    describe('getUsers', () => {
        it('正常にユーザー一覧を取得できる', async () => {
            const mockResponse = {
                users: [
                    {
                        id: 1,
                        username: 'test_user',
                        email: 'test@example.com',
                        firstName: 'Test',
                        lastName: 'User',
                        status: UserStatus.Active,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ],
                pagination: {
                    page: 0,
                    size: 20,
                    totalElements: 1,
                    totalPages: 1
                }
            };

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const result = await usersApi.getUsers({
                page: 0,
                size: 20
            });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-api.example.com/api/v1/users?page=0&size=20',
                expect.objectContaining({
                    method: 'GET'
                })
            );

            expect(result).toEqual(mockResponse);
        });

        it('APIエラーを適切に処理する', async () => {
            const errorResponse = {
                error: 'VALIDATION_ERROR',
                message: 'Invalid page parameter',
                timestamp: '2024-01-01T00:00:00Z'
            };

            mockFetch.mockResolvedValue({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                headers: new Map([['content-type', 'application/json']]),
                json: async () => errorResponse
            });

            await expect(usersApi.getUsers({ page: -1 }))
                .rejects
                .toThrow(ApiError);
        });
    });

    describe('createUser', () => {
        it('正常にユーザーを作成できる', async () => {
            const createRequest = {
                username: 'new_user',
                email: 'new@example.com',
                firstName: 'New',
                lastName: 'User'
            };

            const createdUser = {
                id: 2,
                ...createRequest,
                status: UserStatus.Active,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
            };

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => createdUser
            });

            const result = await usersApi.createUser({
                createUserRequest: createRequest
            });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-api.example.com/api/v1/users',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(createRequest)
                })
            );

            expect(result).toEqual(createdUser);
        });
    });
});
```

## 高度な機能

### 1. インターセプター機能

```typescript
export interface RequestInterceptor {
    (config: RequestInit): RequestInit | Promise<RequestInit>;
}

export interface ResponseInterceptor {
    (response: Response): Response | Promise<Response>;
}

export class EnhancedConfiguration extends Configuration {
    private requestInterceptors: RequestInterceptor[] = [];
    private responseInterceptors: ResponseInterceptor[] = [];

    addRequestInterceptor(interceptor: RequestInterceptor): void {
        this.requestInterceptors.push(interceptor);
    }

    addResponseInterceptor(interceptor: ResponseInterceptor): void {
        this.responseInterceptors.push(interceptor);
    }

    async enhancedFetch(url: string, init: RequestInit = {}): Promise<Response> {
        // リクエストインターセプターを適用
        let finalInit = init;
        for (const interceptor of this.requestInterceptors) {
            finalInit = await interceptor(finalInit);
        }

        // リクエストを実行
        let response = await this.fetchApi(url, finalInit);

        // レスポンスインターセプターを適用
        for (const interceptor of this.responseInterceptors) {
            response = await interceptor(response);
        }

        return response;
    }
}

// 使用例: ログ機能とリトライ機能
const enhancedConfig = new EnhancedConfiguration({
    basePath: 'https://api.example.com/v1'
});

// リクエストログ
enhancedConfig.addRequestInterceptor((config) => {
    console.log('Request:', config);
    return config;
});

// レスポンスログとリトライ
enhancedConfig.addResponseInterceptor(async (response) => {
    console.log('Response:', response.status);
    
    if (response.status === 429) { // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
        // リトライ処理（実装は省略）
    }
    
    return response;
});
```

### 2. キャッシュ機能

```typescript
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

class ApiCache {
    private cache = new Map<string, CacheEntry<any>>();

    set<T>(key: string, data: T, ttlMs: number = 300000): void { // 5分デフォルト
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs
        });
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    clear(): void {
        this.cache.clear();
    }
}

export class CachedUsersApi extends UsersApi {
    private cache = new ApiCache();

    async getUsers(requestParameters: GetUsersRequest = {}): Promise<UserListResponse> {
        const cacheKey = `users:${JSON.stringify(requestParameters)}`;
        const cached = this.cache.get<UserListResponse>(cacheKey);
        
        if (cached) {
            return cached;
        }

        const result = await super.getUsers(requestParameters);
        this.cache.set(cacheKey, result, 60000); // 1分キャッシュ
        
        return result;
    }
}
```

この包括的なTypeScript API Clientの実装により、型安全で使いやすく、拡張可能なAPIクライアントを提供できます。