// Stack layouts used by `mega-rag init`. Each stack declares its source root, extra
// directories, starter files, and an env validator in the stack's own language.
// Avoid "${" in file contents: they are plain JS template literals.

export const PLATFORMS = {
  web: { label: 'Web (Full-Stack)', stacks: ['nextjs', 'nuxt'] },
  mobile: { label: 'Mobile Cross-Platform', stacks: ['flutter', 'expo'] },
  native: { label: 'Native Mobile (iOS / Android)', stacks: ['swiftui', 'compose'] },
  backend: { label: 'Backend API / Microservices', stacks: ['go', 'fastapi', 'rust-axum'] },
  game: { label: 'Game Development', stacks: ['unity', 'godot', 'webgpu'] },
};

export const ARCHITECTURES = {
  layered: {
    label: 'Layered / Clean (presentation → application → domain ← infrastructure)',
    dirs: ['presentation', 'application', 'domain', 'infrastructure'],
  },
  'feature-sliced': {
    label: 'Feature-sliced (app, features, entities, shared)',
    dirs: ['app', 'features', 'entities', 'shared'],
  },
  modular: {
    label: 'Modular monolith (modules/*, shared)',
    dirs: ['modules/example/api', 'modules/example/service', 'modules/example/repository', 'shared'],
  },
};

export const DESIGN = {
  web: [
    { value: 'tailwind-shadcn', label: 'Tailwind v4 + shadcn/ui' },
    { value: 'material3', label: 'Material 3 (MUI)' },
    { value: 'custom', label: 'Custom design tokens' },
  ],
  mobile: [
    { value: 'material3', label: 'Material 3' },
    { value: 'cupertino', label: 'Cupertino / platform-adaptive' },
    { value: 'custom', label: 'Custom design tokens' },
  ],
  native: [
    { value: 'platform-native', label: 'Platform-native (Apple HIG / Material 3)' },
    { value: 'custom', label: 'Custom design tokens' },
  ],
  backend: [{ value: 'none', label: 'None (API only)' }],
  game: [
    { value: 'engine-ui', label: 'Engine UI toolkit' },
    { value: 'custom', label: 'Custom design tokens' },
  ],
};

export const DOMAINS = {
  saas: 'B2B SaaS',
  'e-commerce': 'E-Commerce',
  logistics: 'Logistics / Uber H3',
  gaming: 'Gaming',
  none: 'None',
};

const tsPackage = ({ name, deps = {}, devDeps = {}, scripts = {} }) =>
  JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: { ...scripts, 'rules:sync': 'mega-rag sync', 'rules:check': 'mega-rag check --ci' },
      dependencies: { '@rbalansag/sdk': '^1.0.0', zod: '^4.6.7', ...deps },
      devDependencies: { '@rbalansag/cli': '^1.0.0', '@rbalansag/rules': '^1.0.0', ...devDeps },
    },
    null,
    2,
  ) + '\n';

const DB_ENV = 'DATABASE_URL=postgres://app:app@localhost:5432/app\n';

export const STACKS = {
  nextjs: {
    label: 'Next.js 15 (App Router)',
    lang: 'TypeScript',
    root: 'src',
    dirs: ['src/app', 'src/components', 'src/lib', 'public'],
    ts: true,
    envExample: 'NODE_ENV=development\n' + DB_ENV + 'NEXT_PUBLIC_APP_URL=http://localhost:3000\n',
    env: {
      path: 'src/env.ts',
      content: `import { z } from "zod";
import { createEnvValidator } from "@rbalansag/sdk";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

/** Server-side config. Import \`env\` instead of reading process.env directly. */
export const env = createEnvValidator(schema);
`,
    },
    files: ({ name }) => ({
      'package.json': tsPackage({
        name,
        deps: { next: '^15.0.0', react: '^19.0.0', 'react-dom': '^19.0.0' },
        devDeps: { typescript: '^5.6.3', '@types/node': '^20.14.0', '@types/react': '^19.0.0' },
        scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      }),
    }),
  },

  nuxt: {
    label: 'Nuxt 3 (Vue)',
    lang: 'TypeScript',
    root: 'src',
    dirs: ['src/pages', 'src/components', 'src/composables', 'server/api', 'public'],
    ts: true,
    envExample: DB_ENV + 'NUXT_PUBLIC_APP_URL=http://localhost:3000\n',
    env: {
      path: 'server/utils/env.ts',
      content: `import { z } from "zod";
import { createEnvValidator } from "@rbalansag/sdk";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  NUXT_PUBLIC_APP_URL: z.string().url(),
});

/** Server-side config. Import \`env\` instead of reading process.env directly. */
export const env = createEnvValidator(schema);
`,
    },
    files: ({ name }) => ({
      'package.json': tsPackage({
        name,
        deps: { nuxt: '^3.13.0', vue: '^3.5.0' },
        devDeps: { typescript: '^5.6.3' },
        scripts: { dev: 'nuxt dev', build: 'nuxt build', preview: 'nuxt preview' },
      }),
      'nuxt.config.ts': `export default defineNuxtConfig({
  srcDir: "src/",
  compatibilityDate: "2024-11-01",
  typescript: { strict: true },
});
`,
    }),
  },

  flutter: {
    label: 'Flutter (Dart)',
    lang: 'Dart',
    root: 'lib',
    dirs: ['test', 'assets'],
    envExample: 'API_URL=http://localhost:8080\n',
    env: {
      path: 'lib/core/env.dart',
      content: `/// Compile-time environment. Run with: flutter run --dart-define-from-file=env.json
class Env {
  static const apiUrl = String.fromEnvironment('API_URL');

  /// Call once at startup, before runApp().
  static void validate() {
    final missing = <String>[if (apiUrl.isEmpty) 'API_URL'];
    if (missing.isNotEmpty) {
      throw StateError('Invalid environment configuration. Missing: ' + missing.join(', '));
    }
  }
}
`,
    },
    files: ({ name }) => ({
      'pubspec.yaml': `name: ${name.replace(/-/g, '_')}
description: ${name}
publish_to: none
version: 0.1.0

environment:
  sdk: ">=3.4.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
`,
    }),
  },

  expo: {
    label: 'Expo (React Native)',
    lang: 'TypeScript',
    root: 'src',
    dirs: ['src/screens', 'src/components', 'assets'],
    ts: true,
    envExample: 'EXPO_PUBLIC_API_URL=http://localhost:8080\n',
    env: {
      path: 'src/env.ts',
      content: `import { z } from "zod";
import { createEnvValidator } from "@rbalansag/sdk";

const schema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url(),
});

// Expo inlines EXPO_PUBLIC_* only when referenced statically, so list them explicitly.
export const env = createEnvValidator(schema, {
  source: { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL },
  exit: false, // throw instead of process.exit on device
});
`,
    },
    files: ({ name }) => ({
      'package.json': tsPackage({
        name,
        deps: { expo: '~52.0.0', react: '18.3.1', 'react-native': '0.76.0' },
        devDeps: { typescript: '^5.6.3', '@types/react': '~18.3.12' },
        scripts: { start: 'expo start', android: 'expo start --android', ios: 'expo start --ios' },
      }),
    }),
  },

  swiftui: {
    label: 'SwiftUI (iOS)',
    lang: 'Swift',
    root: 'Sources/App',
    dirs: ['Tests'],
    envExample: 'API_URL=http://localhost:8080\n',
    env: {
      path: 'Sources/App/Core/Env.swift',
      content: `import Foundation

enum Env {
    /// Values come from Info.plist (fed by .xcconfig). Call Env.validate() at launch.
    static func value(_ key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }

    static let apiURL = value("API_URL") ?? ""

    static func validate() {
        let required = ["API_URL"]
        let missing = required.filter { (value($0) ?? "").isEmpty }
        precondition(missing.isEmpty, "Invalid environment configuration. Missing: " + missing.joined(separator: ", "))
    }
}
`,
    },
    files: () => ({}),
    note: 'Layout only: create the Xcode project/app target in Xcode and point it at Sources/App.',
  },

  compose: {
    label: 'Jetpack Compose (Android)',
    lang: 'Kotlin',
    root: 'app/src/main/kotlin/app',
    dirs: ['app/src/test', 'app/src/androidTest'],
    envExample: 'API_URL=http://10.0.2.2:8080\n',
    env: {
      path: 'app/src/main/kotlin/app/core/Env.kt',
      content: `package app.core

// Backed by BuildConfig fields generated from gradle.properties / local.properties.
// Adjust the BuildConfig import to your applicationId.
object Env {
    val apiUrl: String get() = BuildConfig.API_URL

    fun validate() {
        val missing = listOf("API_URL" to apiUrl).filter { it.second.isBlank() }.map { it.first }
        check(missing.isEmpty()) { "Invalid environment configuration. Missing: " + missing.joinToString(", ") }
    }
}
`,
    },
    files: () => ({}),
    note: 'Layout only: create the Android project in Android Studio and merge this source tree.',
  },

  go: {
    label: 'Go 1.22+ (net/http)',
    lang: 'Go',
    root: 'internal',
    dirs: ['cmd/server'],
    envExample: 'PORT=8080\n' + DB_ENV,
    env: {
      path: 'internal/config/env.go',
      content: `package config

import (
	"fmt"
	"os"
	"strings"
)

type Env struct {
	Port        string
	DatabaseURL string
}

// MustLoad reads and validates the environment once at boot and exits with a readable report on failure.
func MustLoad() Env {
	var missing []string
	get := func(key, fallback string) string {
		v := os.Getenv(key)
		if v == "" {
			if fallback != "" {
				return fallback
			}
			missing = append(missing, key)
		}
		return v
	}
	env := Env{Port: get("PORT", "8080"), DatabaseURL: get("DATABASE_URL", "")}
	if len(missing) > 0 {
		fmt.Fprintf(os.Stderr, "Invalid environment configuration. Missing: %s\\n", strings.Join(missing, ", "))
		os.Exit(1)
	}
	return env
}
`,
    },
    files: ({ name }) => ({
      'go.mod': `module ${name}\n\ngo 1.22\n`,
      'cmd/server/main.go': `package main

import (
	"log"
	"net/http"

	"${name}/internal/config"
)

func main() {
	cfg := config.MustLoad()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	log.Printf("listening on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, mux))
}
`,
    }),
  },

  fastapi: {
    label: 'FastAPI (Python)',
    lang: 'Python',
    root: 'app',
    dirs: ['tests'],
    envExample: 'APP_ENV=development\n' + DB_ENV,
    env: {
      path: 'app/core/env.py',
      content: `from functools import lru_cache

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str
    cors_origins: list[str] = []


@lru_cache
def get_settings() -> Settings:
    """Validate the environment once. Exit with a readable report on failure."""
    try:
        return Settings()
    except ValidationError as e:
        names = ", ".join(str(err["loc"][0]).upper() for err in e.errors())
        raise SystemExit("Invalid environment configuration: " + names) from e
`,
    },
    files: () => ({
      'requirements.txt': 'fastapi>=0.115\nuvicorn[standard]>=0.32\npydantic-settings>=2.6\n',
      'app/__init__.py': '',
      'app/core/__init__.py': '',
      'app/main.py': `from fastapi import FastAPI

from app.core.env import get_settings

settings = get_settings()
app = FastAPI()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
`,
    }),
  },

  'rust-axum': {
    label: 'Rust (Axum)',
    lang: 'Rust',
    root: 'src',
    dirs: ['tests'],
    envExample: 'PORT=8080\n' + DB_ENV,
    env: {
      path: 'src/env.rs',
      content: `use std::env;

pub struct Env {
    pub port: u16,
    pub database_url: String,
}

impl Env {
    /// Read and validate the environment once at boot; exit with a readable report on failure.
    pub fn load() -> Env {
        let mut missing: Vec<&str> = Vec::new();
        let mut require = |key: &'static str| {
            env::var(key).unwrap_or_else(|_| {
                missing.push(key);
                String::new()
            })
        };
        let database_url = require("DATABASE_URL");
        let port = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
        if !missing.is_empty() {
            eprintln!("Invalid environment configuration. Missing: {}", missing.join(", "));
            std::process::exit(1);
        }
        Env { port, database_url }
    }
}
`,
    },
    files: ({ name }) => ({
      'Cargo.toml': `[package]
name = "${name}"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
`,
      'src/main.rs': `mod env;

use axum::{routing::get, Router};

#[tokio::main]
async fn main() {
    let cfg = env::Env::load();
    let app = Router::new().route("/healthz", get(|| async { "ok" }));
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", cfg.port)).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
`,
    }),
  },

  unity: {
    label: 'Unity (C# / DOTS)',
    lang: 'C#',
    root: 'Assets/Scripts',
    dirs: ['Assets/Scenes', 'Assets/Prefabs', 'Assets/Art'],
    envExample: 'API_URL=http://localhost:8080\n',
    env: {
      path: 'Assets/Scripts/Core/Env.cs',
      content: `using System;
using System.Linq;

namespace Core
{
    public static class Env
    {
        public static string Get(string key, string fallback = null)
        {
            var v = Environment.GetEnvironmentVariable(key);
            return string.IsNullOrEmpty(v) ? fallback : v;
        }

        /// <summary>Call once at startup with the required variable names.</summary>
        public static void Validate(params string[] required)
        {
            var missing = required.Where(k => string.IsNullOrEmpty(Get(k))).ToArray();
            if (missing.Length > 0)
                throw new InvalidOperationException("Invalid environment configuration. Missing: " + string.Join(", ", missing));
        }
    }
}
`,
    },
    files: () => ({}),
    note: 'Layout only: create the project in Unity Hub, then merge this Assets tree into it.',
  },

  godot: {
    label: 'Godot 4 (GDScript)',
    lang: 'GDScript',
    root: 'scripts',
    dirs: ['scenes', 'assets'],
    envExample: 'API_URL=http://localhost:8080\n',
    env: {
      path: 'scripts/core/env.gd',
      content: `class_name Env
extends RefCounted

## Returns false (and logs) when any required variable is missing. Call once at startup.
static func validate(required: Array[String]) -> bool:
	var missing: Array[String] = []
	for key in required:
		if OS.get_environment(key).is_empty():
			missing.append(key)
	if not missing.is_empty():
		push_error("Invalid environment configuration. Missing: " + ", ".join(missing))
		return false
	return true

static func get_value(key: String, fallback: String = "") -> String:
	var value := OS.get_environment(key)
	return fallback if value.is_empty() else value
`,
    },
    files: () => ({}),
    note: 'Layout only: create the project in the Godot editor, then merge these folders.',
  },

  webgpu: {
    label: 'WebGPU / Three.js (Vite)',
    lang: 'TypeScript',
    root: 'src',
    dirs: ['src/render', 'src/assets', 'public'],
    ts: true,
    envExample: 'VITE_API_URL=http://localhost:8080\n',
    env: {
      path: 'src/env.ts',
      content: `import { z } from "zod";
import { createEnvValidator } from "@rbalansag/sdk";

const schema = z.object({
  VITE_API_URL: z.string().url(),
});

const source = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

export const env = createEnvValidator(schema, { source, exit: false });
`,
    },
    files: ({ name }) => ({
      'package.json': tsPackage({
        name,
        deps: { three: '^0.170.0' },
        devDeps: { typescript: '^5.6.3', vite: '^5.4.10', '@types/three': '^0.170.0', '@webgpu/types': '^0.1.50' },
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      }),
    }),
  },
};

export const GITIGNORE_BASE = ['.env', '.env.local', '.DS_Store'];
export const GITIGNORE_BY_STACK = {
  nextjs: ['node_modules/', '.next/', 'dist/'],
  nuxt: ['node_modules/', '.nuxt/', '.output/', 'dist/'],
  expo: ['node_modules/', '.expo/', 'dist/'],
  webgpu: ['node_modules/', 'dist/'],
  flutter: ['.dart_tool/', 'build/', '.flutter-plugins*'],
  swiftui: ['.build/', 'DerivedData/', 'xcuserdata/'],
  compose: ['build/', '.gradle/', 'local.properties'],
  go: ['bin/'],
  fastapi: ['__pycache__/', '.venv/', '*.pyc'],
  'rust-axum': ['target/'],
  unity: ['Library/', 'Temp/', 'Logs/', 'obj/', 'UserSettings/'],
  godot: ['.godot/', '*.translation'],
};
