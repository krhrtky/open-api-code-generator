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
                content.push_str(&format!("import {import}\n"));
            }
            content.push('\n');
        }

        // Class documentation
        if let Some(description) = &kotlin_class.description {
            content.push_str(&format!("/**\n * {description}\n */\n"));
        }

        // Schema annotation
        if self.include_swagger {
            let desc = kotlin_class
                .description
                .as_deref()
                .unwrap_or(&kotlin_class.name);
            content.push_str(&format!("@Schema(description = \"{desc}\")\n"));
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
            content.push_str(&format!("    /**\n     * {description}\n     */\n"));
        }

        // Schema annotation
        if self.include_swagger {
            let desc = prop.description.as_deref().unwrap_or(&prop.name);
            content.push_str(&format!("    @Schema(description = \"{desc}\""));
            if let Some(default_val) = &prop.default_value {
                if default_val != "null" {
                    content.push_str(&format!(", example = \"{default_val}\""));
                }
            }
            content.push_str(")\n");
        }

        // JsonProperty annotation
        if let Some(json_property) = &prop.json_property {
            content.push_str(&format!("    @JsonProperty(\"{json_property}\")\n"));
        }

        // Validation annotations
        if self.include_validation {
            for validation in &prop.validation {
                content.push_str(&format!("    {validation}\n"));
            }
        }

        // Property declaration
        let nullable_suffix = if prop.nullable { "?" } else { "" };
        let default_suffix = if let Some(default_val) = &prop.default_value {
            format!(" = {default_val}")
        } else {
            String::new()
        };

        content.push_str(&format!(
            "    val {}: {}{}{}",
            prop.name, prop.kotlin_type, nullable_suffix, default_suffix
        ));

        if !is_last {
            content.push(',');
        }

        content.push('\n');

        content
    }

    pub fn generate_kotlin_controller(&self, kotlin_controller: &KotlinController) -> String {
        let mut content = String::new();

        // Package declaration
        content.push_str(&format!("package {}\n\n", kotlin_controller.package_name));

        // Imports
        if !kotlin_controller.imports.is_empty() {
            for import in &kotlin_controller.imports {
                content.push_str(&format!("import {import}\n"));
            }
            content.push('\n');
        }

        // Interface documentation
        if let Some(description) = &kotlin_controller.description {
            content.push_str(&format!("/**\n * {description}\n */\n"));
        }

        // Interface declaration
        content.push_str(&format!("interface {} {{\n\n", kotlin_controller.name));

        // Methods
        for method in &kotlin_controller.methods {
            content.push_str(&self.generate_method_content(method));
            content.push('\n');
        }

        content.push_str("}\n");

        content
    }

    fn generate_method_content(&self, method: &KotlinMethod) -> String {
        let mut content = String::new();

        // Swagger annotations
        if self.include_swagger && (method.summary.is_some() || method.description.is_some()) {
            let summary = method.summary.as_deref().unwrap_or(&method.name);
            content.push_str(&format!("    @Operation(summary = \"{summary}\""));
            if let Some(description) = &method.description {
                content.push_str(&format!(", description = \"{description}\""));
            }
            content.push_str(")\n");

            content.push_str("    @ApiResponses(value = [\n");
            let response_desc = method.response_description.as_deref().unwrap_or("Success");
            content.push_str(&format!(
                "        ApiResponse(responseCode = \"200\", description = \"{response_desc}\"),\n"
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
                content.push_str(&format!("        {validation} "));
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
            content.push('?');
        }

        if !is_last {
            content.push(',');
        }

        content.push('\n');

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_template_engine_creation() {
        let engine = TemplateEngine::new(true, true);
        assert!(engine.include_validation);
        assert!(engine.include_swagger);

        let engine = TemplateEngine::new(false, false);
        assert!(!engine.include_validation);
        assert!(!engine.include_swagger);
    }

    #[test]
    fn test_generate_kotlin_class_basic() {
        let engine = TemplateEngine::new(false, false);
        let kotlin_class = KotlinClass {
            name: "TestClass".to_string(),
            package_name: "com.example.test".to_string(),
            properties: vec![KotlinProperty {
                name: "id".to_string(),
                kotlin_type: "Int".to_string(),
                nullable: false,
                default_value: None,
                description: None,
                json_property: None,
                validation: vec![],
            }],
            imports: vec!["import com.example.utils.Util".to_string()],
            description: Some("Test class description".to_string()),
            is_sealed: None,
            sealed_sub_types: None,
            parent_class: None,
        };

        let result = engine.generate_kotlin_class(&kotlin_class);

        assert!(result.contains("package com.example.test"));
        assert!(result.contains("import com.example.utils.Util"));
        assert!(result.contains("/**\n * Test class description\n */"));
        assert!(result.contains("data class TestClass("));
        assert!(result.contains("val id: Int"));
    }

    #[test]
    fn test_generate_kotlin_class_with_swagger() {
        let engine = TemplateEngine::new(false, true);
        let kotlin_class = KotlinClass {
            name: "UserModel".to_string(),
            package_name: "com.example.model".to_string(),
            properties: vec![KotlinProperty {
                name: "username".to_string(),
                kotlin_type: "String".to_string(),
                nullable: false,
                default_value: Some("\"defaultUser\"".to_string()),
                description: Some("The username".to_string()),
                json_property: Some("user_name".to_string()),
                validation: vec![],
            }],
            imports: vec![],
            description: Some("User model class".to_string()),
            is_sealed: None,
            sealed_sub_types: None,
            parent_class: None,
        };

        let result = engine.generate_kotlin_class(&kotlin_class);

        assert!(result.contains("@Schema(description = \"User model class\")"));
        assert!(result.contains("@Schema(description = \"The username\""));
        assert!(result.contains("@JsonProperty(\"user_name\")"));
        assert!(result.contains("val username: String = \"defaultUser\""));
    }

    #[test]
    fn test_generate_kotlin_class_with_validation() {
        let engine = TemplateEngine::new(true, false);
        let kotlin_class = KotlinClass {
            name: "ValidatedClass".to_string(),
            package_name: "com.example.validated".to_string(),
            properties: vec![KotlinProperty {
                name: "email".to_string(),
                kotlin_type: "String".to_string(),
                nullable: true,
                default_value: None,
                description: None,
                json_property: None,
                validation: vec!["@Email".to_string(), "@NotBlank".to_string()],
            }],
            imports: vec![],
            description: None,
            is_sealed: None,
            sealed_sub_types: None,
            parent_class: None,
        };

        let result = engine.generate_kotlin_class(&kotlin_class);

        assert!(result.contains("@Email"));
        assert!(result.contains("@NotBlank"));
        assert!(result.contains("val email: String?"));
    }

    #[test]
    fn test_generate_kotlin_controller_basic() {
        let engine = TemplateEngine::new(false, false);
        let kotlin_controller = KotlinController {
            name: "UserController".to_string(),
            package_name: "com.example.controller".to_string(),
            methods: vec![KotlinMethod {
                name: "getUser".to_string(),
                http_method: "get".to_string(),
                path: "/user/{id}".to_string(),
                parameters: vec![KotlinParameter {
                    name: "id".to_string(),
                    kotlin_type: "Long".to_string(),
                    param_type: ParameterType::Path,
                    required: true,
                    description: None,
                    validation: vec![],
                }],
                request_body: None,
                return_type: "ResponseEntity<User>".to_string(),
                summary: None,
                description: None,
                response_description: None,
            }],
            imports: vec!["org.springframework.web.bind.annotation.*".to_string()],
            description: Some("User management controller".to_string()),
        };

        let result = engine.generate_kotlin_controller(&kotlin_controller);

        assert!(result.contains("package com.example.controller"));
        assert!(result.contains("import org.springframework.web.bind.annotation.*"));
        assert!(result.contains("/**\n * User management controller\n */"));
        assert!(result.contains("interface UserController {"));
        assert!(result.contains("@GetMapping(\"/user/{id}\")"));
        assert!(result.contains("fun getUser("));
        assert!(result.contains("@PathVariable id: Long"));
        assert!(result.contains("): ResponseEntity<User>"));
    }

    #[test]
    fn test_generate_kotlin_controller_with_swagger() {
        let engine = TemplateEngine::new(false, true);
        let kotlin_controller = KotlinController {
            name: "ApiController".to_string(),
            package_name: "com.example.api".to_string(),
            methods: vec![KotlinMethod {
                name: "createUser".to_string(),
                http_method: "post".to_string(),
                path: "/users".to_string(),
                parameters: vec![],
                request_body: Some(KotlinParameter {
                    name: "user".to_string(),
                    kotlin_type: "User".to_string(),
                    param_type: ParameterType::Body,
                    required: true,
                    description: None,
                    validation: vec![],
                }),
                return_type: "ResponseEntity<User>".to_string(),
                summary: Some("Create a new user".to_string()),
                description: Some("Creates a new user in the system".to_string()),
                response_description: Some("Created user".to_string()),
            }],
            imports: vec![],
            description: None,
        };

        let result = engine.generate_kotlin_controller(&kotlin_controller);

        assert!(result.contains("@Operation(summary = \"Create a new user\", description = \"Creates a new user in the system\")"));
        assert!(result.contains("@ApiResponses(value = ["));
        assert!(
            result.contains("ApiResponse(responseCode = \"200\", description = \"Created user\")")
        );
        assert!(
            result.contains("ApiResponse(responseCode = \"400\", description = \"Bad Request\")")
        );
        assert!(result.contains("@PostMapping(\"/users\")"));
        assert!(result.contains("@RequestBody user: User"));
    }

    #[test]
    fn test_generate_kotlin_controller_with_validation() {
        let engine = TemplateEngine::new(true, false);
        let kotlin_controller = KotlinController {
            name: "ValidatedController".to_string(),
            package_name: "com.example.validated".to_string(),
            methods: vec![KotlinMethod {
                name: "searchUsers".to_string(),
                http_method: "get".to_string(),
                path: "/users/search".to_string(),
                parameters: vec![KotlinParameter {
                    name: "query".to_string(),
                    kotlin_type: "String".to_string(),
                    param_type: ParameterType::Query,
                    required: false,
                    description: None,
                    validation: vec!["@Size(min = 3, max = 50)".to_string()],
                }],
                request_body: None,
                return_type: "List<User>".to_string(),
                summary: None,
                description: None,
                response_description: None,
            }],
            imports: vec![],
            description: None,
        };

        let result = engine.generate_kotlin_controller(&kotlin_controller);

        assert!(result.contains("@Size(min = 3, max = 50)"));
        assert!(result.contains("@RequestParam(required = false) query: String?"));
    }

    #[test]
    fn test_get_http_annotation() {
        let engine = TemplateEngine::new(false, false);

        assert_eq!(engine.get_http_annotation("get"), "GetMapping");
        assert_eq!(engine.get_http_annotation("post"), "PostMapping");
        assert_eq!(engine.get_http_annotation("put"), "PutMapping");
        assert_eq!(engine.get_http_annotation("delete"), "DeleteMapping");
        assert_eq!(engine.get_http_annotation("patch"), "PatchMapping");
        assert_eq!(engine.get_http_annotation("head"), "HeadMapping");
        assert_eq!(engine.get_http_annotation("options"), "OptionsMapping");
        assert_eq!(engine.get_http_annotation("unknown"), "RequestMapping");
    }

    #[test]
    fn test_get_parameter_annotation() {
        let engine = TemplateEngine::new(false, false);

        let path_param = KotlinParameter {
            name: "id".to_string(),
            kotlin_type: "Long".to_string(),
            param_type: ParameterType::Path,
            required: true,
            description: None,
            validation: vec![],
        };
        assert_eq!(
            engine.get_parameter_annotation(&path_param),
            "@PathVariable"
        );

        let query_param = KotlinParameter {
            name: "filter".to_string(),
            kotlin_type: "String".to_string(),
            param_type: ParameterType::Query,
            required: false,
            description: None,
            validation: vec![],
        };
        assert_eq!(
            engine.get_parameter_annotation(&query_param),
            "@RequestParam(required = false)"
        );

        let header_param = KotlinParameter {
            name: "authorization".to_string(),
            kotlin_type: "String".to_string(),
            param_type: ParameterType::Header,
            required: true,
            description: None,
            validation: vec![],
        };
        assert_eq!(
            engine.get_parameter_annotation(&header_param),
            "@RequestHeader(required = true)"
        );

        let body_param = KotlinParameter {
            name: "user".to_string(),
            kotlin_type: "User".to_string(),
            param_type: ParameterType::Body,
            required: true,
            description: None,
            validation: vec![],
        };
        assert_eq!(engine.get_parameter_annotation(&body_param), "@RequestBody");
    }

    #[test]
    fn test_generate_build_file() {
        let engine = TemplateEngine::new(false, false);
        let result = engine.generate_build_file("com.example.test");

        assert!(result.contains("group = \"com.example.test\""));
        assert!(result.contains("kotlin(\"jvm\") version \"1.9.20\""));
        assert!(result.contains("org.springframework.boot:spring-boot-starter-web"));
        assert!(result.contains("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.1.0"));
        assert!(result.contains("jvmTarget = \"17\""));
    }

    #[test]
    fn test_generate_property_content_nullable_with_default() {
        let engine = TemplateEngine::new(false, false);
        let prop = KotlinProperty {
            name: "status".to_string(),
            kotlin_type: "String".to_string(),
            nullable: true,
            default_value: Some("null".to_string()),
            description: Some("The status of the entity".to_string()),
            json_property: None,
            validation: vec![],
        };

        let result = engine.generate_property_content(&prop, true);

        assert!(result.contains("/**\n     * The status of the entity\n     */"));
        assert!(result.contains("val status: String? = null"));
        assert!(!result.contains(",")); // is_last = true
    }

    #[test]
    fn test_generate_property_content_not_last() {
        let engine = TemplateEngine::new(false, false);
        let prop = KotlinProperty {
            name: "name".to_string(),
            kotlin_type: "String".to_string(),
            nullable: false,
            default_value: None,
            description: None,
            json_property: None,
            validation: vec![],
        };

        let result = engine.generate_property_content(&prop, false);

        assert!(result.contains("val name: String,")); // is_last = false
    }

    #[test]
    fn test_generate_method_content_with_multiple_parameters() {
        let engine = TemplateEngine::new(true, true);
        let method = KotlinMethod {
            name: "updateUser".to_string(),
            http_method: "put".to_string(),
            path: "/users/{id}".to_string(),
            parameters: vec![
                KotlinParameter {
                    name: "id".to_string(),
                    kotlin_type: "Long".to_string(),
                    param_type: ParameterType::Path,
                    required: true,
                    description: None,
                    validation: vec![],
                },
                KotlinParameter {
                    name: "version".to_string(),
                    kotlin_type: "String".to_string(),
                    param_type: ParameterType::Header,
                    required: false,
                    description: None,
                    validation: vec!["@Pattern(regexp = \"v[0-9]+\")".to_string()],
                },
            ],
            request_body: Some(KotlinParameter {
                name: "user".to_string(),
                kotlin_type: "User".to_string(),
                param_type: ParameterType::Body,
                required: true,
                description: None,
                validation: vec!["@Valid".to_string()],
            }),
            return_type: "ResponseEntity<User>".to_string(),
            summary: Some("Update user".to_string()),
            description: None,
            response_description: None,
        };

        let result = engine.generate_method_content(&method);

        assert!(result.contains("@Operation(summary = \"Update user\")"));
        assert!(result.contains("@PutMapping(\"/users/{id}\")"));
        assert!(result.contains("@PathVariable id: Long,"));
        assert!(result.contains(
            "@Pattern(regexp = \"v[0-9]+\") @RequestHeader(required = false) version: String?,"
        ));
        assert!(result.contains("@Valid @RequestBody user: User"));
        assert!(result.contains("): ResponseEntity<User>"));
    }

    #[test]
    fn test_generate_parameter_content_optional_query_param() {
        let engine = TemplateEngine::new(false, false);
        let param = KotlinParameter {
            name: "limit".to_string(),
            kotlin_type: "Int".to_string(),
            param_type: ParameterType::Query,
            required: false,
            description: None,
            validation: vec![],
        };

        let result = engine.generate_parameter_content(&param, false);

        assert!(result.contains("@RequestParam(required = false) limit: Int?,"));
    }
}
