package com.example.api.model

import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema
import java.time.OffsetDateTime
import javax.validation.Valid
import javax.validation.constraints.*

/**
 * Standard error response format
 */
@Schema(description = "Standard error response format")
data class ErrorResponse(
    /**
     * Error code or type
     */
    @Schema(description = "Error code or type"))
    @NotNull
    val error: String,
    /**
     * Human-readable error message
     */
    @Schema(description = "Human-readable error message"))
    @NotNull
    val message: String,
    /**
     * When the error occurred
     */
    @Schema(description = "When the error occurred"))
    @NotNull
    val timestamp: java.time.OffsetDateTime,
    /**
     * Additional error details
     */
    @Schema(description = "Additional error details"))
    val details: List<String>? = null
)
