# AGENTS.md - Development Guidelines for ServerStats Plugin

## Hardcoded Development Rules

**MANDATORY: These rules must always be followed without exception.**

1. **Complete Implementation Only**: Never put any placeholder, stubs, mock, simulation, half-implementation, or future TODOs in the codebase. All code must be fully functional and complete.

2. **Recursive Analysis & Development**: If you come across any previously present placeholder, stubs, mock, simulation, half-implementation, or future TODOs in the codebase, first recursively analyze all affected or will-be-affected files and understand what they will add to the project, then develop them completely. Each and every affected or will-be-affected directory, file, test, or config must be fully implemented.

3. **Deletion Policy**: Never delete anything until you confirm two things:
   - The file you are deleting is absolutely useless and does not add or will not add any smartness or greatness to the codebase, and an even better alternative is present
   - The file cannot be implemented or fully developed practically

4. **Testing Requirement**: Never assume that your code is working. Always unit test and test the complete system.

5. **DRY Principle**: Never repeat code. Always code once and reuse everywhere. Always write smart code and logic that can be referenced or imported everywhere.

6. **File Management**: Never clutter and keep creating new files or folders or temp code. Always first try to update old already present files. If complete file is missing then create new.

7. **Test Organization**: Always put any temp or test files in the test directory and always create subdirectories and named test files to let users know what that file is for.

8. **System Design**: Make sure to always create complete systems that are fully configurable, portable, isolatable, and put every needed binary, file, or dependency inside the codebase. Never hardcode any value, config, or path.

9. **Code Quality**: Always make sure to write clean, readable, and maintainable code. Follow standard coding practices and conventions.

10. **Documentation**: Always make sure to write complete and up-to-date documentation for all the code you write. Follow standard documentation practices and conventions.

11. **Code Review**: Always review your code before committing or replying that you completed the asked task. Make sure it follows all the guidelines and best practices.

12. **Dependency Management**: Always use the latest stable versions of dependencies. Never use outdated or vulnerable dependencies.

13. **Codebase Integrity**: Never break the codebase. Always make sure that the codebase is always in a working state.


## Build System & Commands

### Build Commands
```bash
# Full build with shadow JAR
./gradlew build

# Clean build
./gradlew clean build

# Create shadow JAR (fat JAR with dependencies)
./gradlew shadowJar

# Build without tests
./gradlew build -x test
```

### Development Commands
```bash
# Run with hot reload (if supported by IDE)
./gradlew --continuous build

# Check dependencies
./gradlew dependencies

# View all available tasks
./gradlew tasks
```

### Testing Commands
```
No unit tests are currently implemented in this project.
Consider adding JUnit 5 and Mockito for testing event handlers and service methods.
```

### Single Test Execution
```
Not applicable - no tests exist yet.
Future test structure would use: ./gradlew test --tests "*TestClass.testMethod"
```

## Code Style Guidelines

### Language & Environment
- **Language**: Java 17
- **Build Tool**: Gradle with Kotlin DSL (build.gradle.kts)
- **Encoding**: UTF-8 for all source files
- **Line Endings**: Unix-style (LF)
- **Indentation**: 4 spaces (no tabs)

### Package Structure
```
src/main/java/com/serverstats/
├── ServerStatsPlugin.java          # Main plugin class
├── http/                           # HTTP server components
├── model/                          # Data models (records, POJOs)
├── service/                        # Business logic services
└── util/                          # Utility classes
```

### Naming Conventions

#### Classes & Interfaces
- **Classes**: PascalCase (e.g., `PlayerStatsService`, `JsonLogger`)
- **Interfaces**: PascalCase with 'I' prefix if needed (rarely used)
- **Records**: PascalCase (e.g., `PlayerActivityRecord`)
- **Enums**: PascalCase

#### Methods & Variables
- **Methods**: camelCase (e.g., `playerSnapshot()`, `recordActivity()`)
- **Fields**: camelCase (e.g., `playerStatsService`, `activityLimitPerPlayer`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `SERVICE_NAME`, `GSON`)
- **Parameters**: camelCase (e.g., `playerId`, `event`)
- **Local Variables**: camelCase (e.g., `snapshot`, `record`)

#### Packages
- Lowercase with dots (e.g., `com.serverstats.http`)
- Follow reverse domain naming convention

### Import Organization
```java
// Java standard library imports (grouped by package)
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

// Third-party library imports
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

// Minecraft/Bukkit imports
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

// Project imports (organized by package depth)
import com.serverstats.model.PlayerActivityRecord;
import com.serverstats.service.PlayerStatsService;
```

**Rules**:
- No wildcard imports (`import java.util.*;`)
- Group imports logically (standard library → third-party → project)
- Sort alphabetically within groups
- One import per line

### Class Structure & Patterns

#### Utility Classes
```java
public final class JsonLogger {
    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();

    private JsonLogger() {
        // Private constructor for utility class
    }

    public static void info(String event, Map<String, Object> context) {
        // Implementation
    }
}
```

#### Service Classes
```java
public final class PlayerStatsService {
    private final int activityLimitPerPlayer;
    private final Map<UUID, Long> accumulatedPlaytimeMs = new ConcurrentHashMap<>();

    public PlayerStatsService(int activityLimitPerPlayer) {
        this.activityLimitPerPlayer = activityLimitPerPlayer;
    }

    // Public methods
    public void recordActivity(PlayerActivityRecord record) {
        // Implementation
    }

    // Private helper methods
    private long computePlaytimeSeconds(UUID id) {
        // Implementation
    }
}
```

#### Data Models (Records)
```java
public record PlayerActivityRecord(
    UUID playerId,
    String playerName,
    String action,
    String target,
    Location location,
    String tool,
    int amount,
    String detail,
    Instant timestamp
) {
    // Static factory methods for different activity types
    public static PlayerActivityRecord blockBreak(UUID playerId, String playerName, String blockType, Location location, String tool, Instant timestamp) {
        return new PlayerActivityRecord(playerId, playerName, "BLOCK_BREAK", blockType, location, tool, 1, null, timestamp);
    }

    // Instance methods
    public Map<String, Object> toMap() {
        // Implementation
    }
}
```

### Method Design Patterns

#### Builder Pattern Alternative
Use static factory methods instead of builders for simple objects:
```java
// Preferred
public static PlayerActivityRecord blockBreak(UUID playerId, String playerName, String blockType, Location location, String tool, Instant timestamp) {
    return new PlayerActivityRecord(playerId, playerName, "BLOCK_BREAK", blockType, location, tool, 1, null, timestamp);
}

// Avoid complex builders for simple data
```

#### Functional Interfaces
```java
@FunctionalInterface
private interface SupplierWithException<T> {
    T get() throws Exception;
}
```

### Error Handling & Logging

#### Logging Pattern
```java
// Structured JSON logging
JsonLogger.info("player_join", Map.of(
    "player_id", player.getUniqueId().toString(),
    "player_name", player.getName(),
    "timestamp", Instant.now().toString()
));

// Error logging with context
JsonLogger.error("http_start_failed", Map.of("port", port), e);
```

#### Exception Handling
```java
// Graceful degradation
private double safeTpsIndex(int index) {
    try {
        double[] tps = Bukkit.getServer().getTPS();
        if (tps != null && tps.length > index) {
            return tps[index];
        }
    } catch (NoSuchMethodError err) {
        JsonLogger.warn("tps_unavailable", Map.of("index", index), err);
    }
    return -1D;
}

// Startup failures
public void start() {
    try {
        // Implementation
    } catch (IOException e) {
        JsonLogger.error("http_start_failed", Map.of("port", port), e);
        throw new IllegalStateException("Failed to start HTTP server", e);
    }
}
```

### Thread Safety & Concurrency

#### Thread-Safe Collections
```java
private final Map<UUID, Long> accumulatedPlaytimeMs = new ConcurrentHashMap<>();
private final Map<UUID, Long> sessionStartMs = new ConcurrentHashMap<>();
private final Map<UUID, LinkedList<PlayerActivityRecord>> activities = new ConcurrentHashMap<>();
```

#### Executor Services
```java
private ExecutorService executorService;

public void start() {
    executorService = Executors.newCachedThreadPool();
    server.setExecutor(executorService);
}

public void stop() {
    if (executorService != null && !executorService.isShutdown()) {
        executorService.shutdownNow();
    }
}
```

### Resource Management

#### Try-With-Resources
```java
try (OutputStream os = exchange.getResponseBody()) {
    os.write(bytes);
} catch (IOException e) {
    // Handle exception
}
```

#### HTTP Server Lifecycle
```java
public void stop() {
    if (server != null) {
        server.stop(0);
    }
    if (executorService != null && !executorService.isShutdown()) {
        executorService.shutdownNow();
    }
}
```

### Code Formatting

#### Braces & Indentation
```java
// Consistent bracing style
public void method() {
    if (condition) {
        doSomething();
    } else {
        doSomethingElse();
    }
}

// Method chaining
return playerStatsService.allPlayerSnapshots()
    .stream()
    .filter(snapshot -> snapshot.containsKey("player_name"))
    .collect(Collectors.toList());
```

#### Line Length
- Maximum 120 characters per line
- Break long lines logically
- Use meaningful variable names to avoid long lines

### Dependencies & Libraries

#### Core Dependencies
```kotlin
// build.gradle.kts
dependencies {
    compileOnly("io.papermc.paper:paper-api:1.20.1-R0.1-SNAPSHOT")
    implementation("com.google.code.gson:gson:2.10.1")
}
```

#### Shadow Plugin Configuration
```kotlin
plugins {
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

tasks.shadowJar {
    archiveClassifier.set("")
    minimize()
}
```

### Configuration Management

#### Plugin Configuration (config.yml)
```yaml
http:
  port: 8088
broadcast:
  interval_ticks: 200
activity:
  per_player_limit: 200
```

#### Accessing Configuration
```java
@Override
public void onEnable() {
    saveDefaultConfig();
    int activityLimit = getConfig().getInt("activity.per_player_limit", 200);
    // Use configuration values
}
```

### Plugin Metadata (plugin.yml)
```yaml
name: Serverstats
main: com.serverstats.ServerStatsPlugin
version: 1.0.0
author: serverstats
api-version: "1.20"
```

### Best Practices

#### Performance
- Use `ConcurrentHashMap` for shared mutable state
- Limit activity records per player to prevent memory leaks
- Use efficient data structures (`LinkedList` for FIFO operations)

#### Security
- Validate all inputs from players/events
- Use parameterized queries if database is added
- Log security-relevant events

#### Maintainability
- Single Responsibility Principle (one class, one purpose)
- Dependency Injection through constructor parameters
- Immutable data structures where possible
- Comprehensive logging with structured data

#### Testing Readiness
- Design classes to be testable (dependency injection)
- Use interfaces for external dependencies
- Avoid static methods that are hard to mock
- Consider adding JUnit 5 and Mockito for future testing

### IDE Configuration

#### Recommended Settings
- **JDK**: Java 17
- **Encoding**: UTF-8
- **Line Endings**: Unix (LF)
- **Indentation**: 4 spaces
- **Imports**: Optimize imports on save
- **Formatting**: Use consistent brace placement

#### IntelliJ IDEA
- Enable "Optimize imports on the fly"
- Set "Right margin (columns)" to 120
- Enable "Use single class import"
- Configure code style scheme for Java

This document should be updated as the codebase evolves and new patterns emerge.</content>
<parameter name="filePath">C:\Users\Cartoon\Desktop\MINEMANAGER\nc-mineman\plugins\AGENTS.md