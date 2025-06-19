package com.example.userapi.model

import javax.validation.constraints.*
import javax.validation.Valid
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema
import java.net.URI
import java.time.LocalDate

/**
 * Request body for updating user profile
 */
@Schema(description = "Request body for updating user profile")
data class UpdateProfileRequest(
    /**
     * User's biography or description
     */
    @Schema(description = "User's biography or description")
    @Size(min = 0, max = 500)
    val bio: String? = null,
    /**
     * User's location
     */
    @Schema(description = "User's location")
    @Size(min = 0, max = 100)
    val location: String? = null,
    /**
     * User's website URL
     */
    @Schema(description = "User's website URL")
    @Size(min = 0, max = 255)
    val website: java.net.URI? = null,
    /**
     * User's birth date
     */
    @Schema(description = "User's birth date")
    val birthDate: java.time.LocalDate? = null,
    /**
     * Social media links
     */
    @Schema(description = "Social media links")
    @Valid
    val socialLinks: Map<String, Any>? = null
)
