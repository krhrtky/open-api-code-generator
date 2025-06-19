package com.example.userapi.model

import javax.validation.constraints.*
import javax.validation.Valid
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema

/**
 * Pagination metadata
 */
@Schema(description = "Pagination metadata")
data class PaginationInfo(
    /**
     * Current page number
     */
    @Schema(description = "Current page number")
    @NotNull
    @Min(1)
    val page: Int,
    /**
     * Number of items per page
     */
    @Schema(description = "Number of items per page")
    @NotNull
    @Min(1)
    val size: Int,
    /**
     * Total number of elements
     */
    @Schema(description = "Total number of elements")
    @NotNull
    val totalElements: Long,
    /**
     * Total number of pages
     */
    @Schema(description = "Total number of pages")
    @NotNull
    @Min(0)
    val totalPages: Int,
    /**
     * Whether there is a next page
     */
    @Schema(description = "Whether there is a next page")
    val hasNext: Boolean? = null,
    /**
     * Whether there is a previous page
     */
    @Schema(description = "Whether there is a previous page")
    val hasPrevious: Boolean? = null
)
