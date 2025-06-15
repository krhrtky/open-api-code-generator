use crate::types::*;

pub struct TemplateEngine {
    include_validation: bool,
    include_swagger: bool,
}

impl TemplateEngine {
    pub fn new(include_validation: bool, include_swagger: bool) -> Self {
        Self {
            include_validation,
            include_swagger,
        }
    }

    pub fn generate_kotlin_class(&self, kotlin_class: &KotlinClass) -> String {
        let mut content = String::new();

        // Package declaration
        content.push_str(&format!("package {}\n\n", kotlin_class.package_name));

        // Imports
        if !kotlin_class.imports.is_empty() {
            for import in &kotlin_class.imports {
                content.push_str(&format!("import {}\n", import));
            }
            content.push_str("\n");
        }

        // Class documentation
        if let Some(description) = &kotlin_class.description {
            content.push_str(&format!("/**\n * {}\n */\n", description));
        }

        // Schema annotation
        if self.include_swagger {
            let desc = kotlin_class
                .description
                .as_deref()
                .unwrap_or(&kotlin_class.name);
            content.push_str(&format!("@Schema(description = \"{}\")\n", desc));
        }

        // Class declaration
        content.push_str(&format!("data class {}(\n", kotlin_class.name));

        // Properties
        for (i, prop) in kotlin_class.properties.iter().enumerate() {
            let is_last = i == kotlin_class.properties.len() - 1;
            content.push_str(&self.generate_property_content(prop, is_last));
        }

        content.push_str(")\n");

        content
    }

    fn generate_property_content(&self, prop: &KotlinProperty, is_last: bool) -> String {
        let mut content = String::new();

        // Property documentation
        if let Some(description) = &prop.description {
            content.push_str(&format!("    /**\n     * {}\n     */\n", description));
        }

        // Schema annotation
        if self.include_swagger {
            let desc = prop.description.as_deref().unwrap_or(&prop.name);
            content.push_str(&format!("    @Schema(description = \"{}\"", desc));
            if let Some(default_val) = &prop.default_value {
                if default_val != "null" {
                    content.push_str(&format!(", example = \"{}\"", default_val));
                }
            }
            content.push_str(")\n");
        }

        // JsonProperty annotation
        if let Some(json_property) = &prop.json_property {
            content.push_str(&format!("    @JsonProperty(\"{}\")\n", json_property));
        }

        // Validation annotations
        if self.include_validation {
            for validation in &prop.validation {
                content.push_str(&format!("    {}\n", validation));
            }
        }

        // Property declaration
        let nullable_suffix = if prop.nullable { "?" } else { "" };
        let default_suffix = if let Some(default_val) = &prop.default_value {
            format!(" = {}", default_val)
        } else {
            String::new()
        };

        content.push_str(&format!(
            "    val {}: {}{}{}",
            prop.name, prop.kotlin_type, nullable_suffix, default_suffix
        ));

        if !is_last {
            content.push_str(",");
        }

        content.push_str("\n");

        content
    }

    pub fn generate_kotlin_controller(&self, kotlin_controller: &KotlinController) -> String {
        let mut content = String::new();

        // Package declaration
        content.push_str(&format!("package {}\n\n", kotlin_controller.package_name));

        // Imports
        if !kotlin_controller.imports.is_empty() {
            for import in &kotlin_controller.imports {
                content.push_str(&format!("import {}\n", import));
            }
            content.push_str("\n");
        }

        // Interface documentation
        if let Some(description) = &kotlin_controller.description {
            content.push_str(&format!("/**\n * {}\n */\n", description));
        }

        // Interface declaration
        content.push_str(&format!("interface {} {{\n\n", kotlin_controller.name));

        // Methods
        for method in &kotlin_controller.methods {
            content.push_str(&self.generate_method_content(method));
            content.push_str("\n");
        }

        content.push_str("}\n");

        content
    }

    fn generate_method_content(&self, method: &KotlinMethod) -> String {
        let mut content = String::new();

        // Swagger annotations
        if self.include_swagger && (method.summary.is_some() || method.description.is_some()) {
            let summary = method.summary.as_deref().unwrap_or(&method.name);
            content.push_str(&format!("    @Operation(summary = \"{}\"", summary));
            if let Some(description) = &method.description {
                content.push_str(&format!(", description = \"{}\"", description));
            }
            content.push_str(")\n");

            content.push_str("    @ApiResponses(value = [\n");
            let response_desc = method.response_description.as_deref().unwrap_or("Success");
            content.push_str(&format!(
                "        ApiResponse(responseCode = \"200\", description = \"{}\"),\n",
                response_desc
            ));
            content.push_str(
                "        ApiResponse(responseCode = \"400\", description = \"Bad Request\")\n",
            );
            content.push_str("    ])\n");
        }

        // HTTP mapping annotation
        let http_annotation = self.get_http_annotation(&method.http_method);
        content.push_str(&format!("    @{}(\"{}\")\n", http_annotation, method.path));

        // Method signature
        content.push_str(&format!("    fun {}(\n", method.name));

        // Parameters
        let mut all_params = method.parameters.clone();
        if let Some(request_body) = &method.request_body {
            all_params.push(request_body.clone());
        }

        for (i, param) in all_params.iter().enumerate() {
            let is_last = i == all_params.len() - 1;
            content.push_str(&self.generate_parameter_content(param, is_last));
        }

        content.push_str(&format!("    ): {}\n", method.return_type));

        content
    }

    fn generate_parameter_content(&self, param: &KotlinParameter, is_last: bool) -> String {
        let mut content = String::new();

        // Validation annotations
        if self.include_validation {
            for validation in &param.validation {
                content.push_str(&format!("        {} ", validation));
            }
        }

        // Parameter annotation
        let annotation = self.get_parameter_annotation(param);
        content.push_str(&format!(
            "{} {}: {}",
            annotation, param.name, param.kotlin_type
        ));

        // Nullable suffix for optional parameters
        if !param.required && !matches!(param.param_type, ParameterType::Body) {
            content.push_str("?");
        }

        if !is_last {
            content.push_str(",");
        }

        content.push_str("\n");

        content
    }

    fn get_http_annotation(&self, method: &str) -> &'static str {
        match method {
            "get" => "GetMapping",
            "post" => "PostMapping",
            "put" => "PutMapping",
            "delete" => "DeleteMapping",
            "patch" => "PatchMapping",
            "head" => "HeadMapping",
            "options" => "OptionsMapping",
            _ => "RequestMapping",
        }
    }

    fn get_parameter_annotation(&self, param: &KotlinParameter) -> String {
        match param.param_type {
            ParameterType::Path => "@PathVariable".to_string(),
            ParameterType::Query => format!("@RequestParam(required = {})", param.required),
            ParameterType::Header => format!("@RequestHeader(required = {})", param.required),
            ParameterType::Body => "@RequestBody".to_string(),
        }
    }

    pub fn generate_build_file(&self, base_package: &str) -> String {
        format!(
            r#"plugins {{
    kotlin("jvm") version "1.9.20"
    kotlin("plugin.spring") version "1.9.20"
    id("org.springframework.boot") version "3.1.0"
    id("io.spring.dependency-management") version "1.1.0"
}}

group = "{}"
version = "0.0.1-SNAPSHOT"

repositories {{
    mavenCentral()
}}

dependencies {{
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.1.0")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {{
    kotlinOptions {{
        freeCompilerArgs = listOf("-Xjsr305=strict")
        jvmTarget = "17"
    }}
}}

tasks.withType<Test> {{
    useJUnitPlatform()
}}
"#,
            base_package
        )
    }
}
