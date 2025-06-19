package com.example.userapi.model

import javax.validation.constraints.*
import javax.validation.Valid
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema

/**
 * Request body for updating an existing user
 */
@Schema(description = "Request body for updating an existing user")
data class UpdateUserRequest(
    /**
     * User's first name
     */
    @Schema(description = "User's first name")
    @Size(min = 1, max = 50)
    val firstName: String? = null,
    /**
     * User's last name
     */
    @Schema(description = "User's last name")
    @Size(min = 1, max = 50)
    val lastName: String? = null,
    /**
     * Whether the user account is active
     */
    @Schema(description = "Whether the user account is active")
    val isActive: Boolean? = null
)
