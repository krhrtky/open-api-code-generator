package com.benchmark.model

import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema
import javax.validation.Valid
import javax.validation.constraints.*
import javax.validation.constraints.NotBlank
import javax.validation.constraints.NotEmpty
import javax.validation.constraints.NotNull

@Schema(description = "Model91")
data class Model91(
    @Schema(description = "id")
    @NotNull
    val id: Int,
    @Schema(description = "name")
    @NotNull
    val name: String,
    @Schema(description = "description")
    val description: String? = null,
    @Schema(description = "status")
    val status: String? = null,
    @Schema(description = "metadata")
    @Valid
    val metadata: Metadata? = null
)