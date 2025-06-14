package com.example.api.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import javax.validation.Valid
import javax.validation.constraints.*
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

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
        @Min(1) @RequestParam(required = false) page: Int?,
        @Min(1)         @Max(100) @RequestParam(required = false) size: Int?,
        @Size(min = 0, max = 100) @RequestParam(required = false) filter: String?
    ): ResponseEntity<Map<String, Any>>

    @Operation(summary = "Create a new user", description = "Create a new user account")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "User created successfully"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @PostMapping("/users")
    fun createUser(
        @Valid @RequestBody body: Map<String, Any>
    ): ResponseEntity<Map<String, Any>>

    @Operation(summary = "Get user by ID", description = "Retrieve a specific user by their unique identifier")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "User retrieved successfully"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @GetMapping("/users/{userId}")
    fun getUserById(
        @NotNull         @Min(1) @PathVariable userId: Long
    ): ResponseEntity<Map<String, Any>>

    @Operation(summary = "Update user", description = "Update an existing user's information")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "User updated successfully"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @PutMapping("/users/{userId}")
    fun updateUser(
        @NotNull         @Min(1) @PathVariable userId: Long,
        @Valid @RequestBody body: Map<String, Any>
    ): ResponseEntity<Map<String, Any>>

    @Operation(summary = "Delete user", description = "Delete a user account")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "Success"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @DeleteMapping("/users/{userId}")
    fun deleteUser(
        @NotNull         @Min(1) @PathVariable userId: Long
    ): ResponseEntity<Any>

}
