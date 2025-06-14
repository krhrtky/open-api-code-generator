package com.example.api.model

import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema
import javax.validation.Valid
import javax.validation.constraints.*

/**
 * Request body for creating a new user
 */
@Schema(description = "Request body for creating a new user")
data class CreateUserRequest(
    /**
     * User's email address (must be unique)
     */
    @Schema(description = "User's email address (must be unique)"))
    @NotNull
    @Email
    @Size(min = 0, max = 255)
    val email: String,
    /**
     * User's first name
     */
    @Schema(description = "User's first name"))
    @NotNull
    @Size(min = 1, max = 50)
    val firstName: String,
    /**
     * User's last name
     */
    @Schema(description = "User's last name"))
    @NotNull
    @Size(min = 1, max = 50)
    val lastName: String,
    /**
     * User's password
     */
    @Schema(description = "User's password"))
    @Size(min = 8, max = 128)
    val password: String? = null
)
