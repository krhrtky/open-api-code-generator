package com.example.userapi.model

import javax.validation.constraints.*
import javax.validation.Valid
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema
import java.time.OffsetDateTime
import java.time.OffsetDateTime

/**
 * User entity representing a registered user
 */
@Schema(description = "User entity representing a registered user")
data class User(
    /**
     * Unique identifier for the user
     */
    @Schema(description = "Unique identifier for the user")
    @NotNull
    val id: Long,
    /**
     * User's email address (unique)
     */
    @Schema(description = "User's email address (unique)")
    @NotNull
    @Email
    @Size(min = 0, max = 255)
    val email: String,
    /**
     * User's first name
     */
    @Schema(description = "User's first name")
    @NotNull
    @Size(min = 1, max = 50)
    val firstName: String,
    /**
     * User's last name
     */
    @Schema(description = "User's last name")
    @NotNull
    @Size(min = 1, max = 50)
    val lastName: String,
    /**
     * Whether the user account is active
     */
    @Schema(description = "Whether the user account is active", example = "true")
    val isActive: Boolean? = true,
    /**
     * Timestamp when the user was created
     */
    @Schema(description = "Timestamp when the user was created")
    @NotNull
    val createdAt: java.time.OffsetDateTime,
    /**
     * Timestamp when the user was last updated
     */
    @Schema(description = "Timestamp when the user was last updated")
    @NotNull
    val updatedAt: java.time.OffsetDateTime
)
