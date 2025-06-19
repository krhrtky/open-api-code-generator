package com.example.userapi.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import javax.validation.Valid
import javax.validation.constraints.*
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses

/**
 * Profile API controller interface
 */
interface ProfileController {

    @Operation(summary = "Get user profile", description = "Retrieve the profile information for a specific user")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "User profile retrieved successfully"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @GetMapping("/users/{userId}/profile")
    fun getUserProfile(
        @NotNull @PathVariable userId: Long
    ): ResponseEntity<Any>

    @Operation(summary = "Update user profile", description = "Partially update a user's profile information")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "Profile updated successfully"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @PatchMapping("/users/{userId}/profile")
    fun updateUserProfile(
        @NotNull @PathVariable userId: Long,
        @Valid @RequestBody body: Any
    ): ResponseEntity<Any>

}
