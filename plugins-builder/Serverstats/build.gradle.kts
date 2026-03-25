plugins {
    java
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

group = "com.serverstats"
version = "1.0.2"

repositories {
    mavenCentral()
    maven("https://papermc.io/repo/repository/maven-public/")
    maven("https://repo.papermc.io/repository/maven-public/")
    maven("https://repo.spongepowered.org/repository/maven-public/")
    maven("https://hub.spigotmc.org/nexus/content/repositories/snapshots/")
}

dependencies {
    // Multi-platform server support (Paper, Folia, Spigot, etc.)
    // Using compileOnly to avoid runtime conflicts - servers provide these at runtime
    compileOnly("org.spigotmc:spigot-api:1.20.1-R0.1-SNAPSHOT") {
        exclude(group = "junit")
    }
    // Paper API extends Spigot, so we primarily use Spigot as base
    // Folia and Velocity support detected at runtime

    // Core dependencies
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("com.h2database:h2:2.2.224")  // Embedded database for development
    implementation("org.postgresql:postgresql:42.7.3")  // Production database
    implementation("com.zaxxer:HikariCP:5.0.1")  // Connection pooling
    implementation("io.jsonwebtoken:jjwt-api:0.12.3")
    implementation("io.jsonwebtoken:jjwt-impl:0.12.3")
    implementation("io.jsonwebtoken:jjwt-jackson:0.12.3")  // JWT for authentication
    implementation("org.java-websocket:Java-WebSocket:1.5.4")  // WebSocket support
    implementation("com.graphql-java:graphql-java:21.3")  // GraphQL support
    implementation("org.redisson:redisson:3.27.1")  // Redis for caching
    implementation("com.fasterxml.jackson.core:jackson-databind:2.16.1")  // JSON processing

    // Test dependencies
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
    testImplementation("org.mockito:mockito-core:5.8.0")
    testImplementation("com.h2database:h2:2.2.224")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(24))
    }
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
}

tasks.withType<Jar> {
    archiveBaseName.set("Serverstats")
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}

tasks.withType<com.github.jengelman.gradle.plugins.shadow.tasks.ShadowJar> {
    archiveClassifier.set("")
    minimize()
}

tasks.build {
    dependsOn(tasks.shadowJar)
}
