package com.example.userapi.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import javax.validation.Valid
import javax.validation.constraints.*
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses

/**
 * User API controller interface
 */
interface UserController {

    @Operation(summary = "Get all users", description = "Retrieve a list of all users with optional filtering and pagination")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "List of users retrieved successfully"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @GetMapping("/users")
    fun getUsers(
@RequestParam(required = false) page: Int?,
@RequestParam(required = false) size: Int?,
@RequestParam(required = false) filter: String?
    ): ResponseEntity<Map<String, Any>>

    @Operation(summary = "Create a new user", description = "Create a new user account")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "User created successfully"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @PostMapping("/users")
    fun createUser(
        @Valid @RequestBody body: Any
    ): ResponseEntity<Any>

    @Operation(summary = "Get user by ID", description = "Retrieve a specific user by their unique identifier")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "User retrieved successfully"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @GetMapping("/users/{userId}")
    fun getUserById(
        @NotNull @PathVariable userId: Long
    ): ResponseEntity<Any>

    @Operation(summary = "Update user", description = "Update an existing user's information")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "User updated successfully"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @PutMapping("/users/{userId}")
    fun updateUser(
        @NotNull @PathVariable userId: Long,
        @Valid @RequestBody body: Any
    ): ResponseEntity<Any>

    @Operation(summary = "Delete user", description = "Delete a user account")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "Success"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @DeleteMapping("/users/{userId}")
    fun deleteUser(
        @NotNull @PathVariable userId: Long
    ): ResponseEntity<Any>

}
