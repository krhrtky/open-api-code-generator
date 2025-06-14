package com.example.api.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import javax.validation.Valid
import javax.validation.constraints.*
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

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
        @NotNull         @Min(1) @PathVariable userId: Long
    ): ResponseEntity<Map<String, Any>>

    @Operation(summary = "Update user profile", description = "Partially update a user's profile information")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "Profile updated successfully"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @PatchMapping("/users/{userId}/profile")
    fun updateUserProfile(
        @NotNull         @Min(1) @PathVariable userId: Long,
        @Valid @RequestBody body: Map<String, Any>
    ): ResponseEntity<Map<String, Any>>

}
