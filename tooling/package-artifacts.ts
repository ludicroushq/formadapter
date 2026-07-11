import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: unknown;
  files?: string[];
  main?: string;
  module?: string;
  name: string;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  private?: boolean;
  types?: string;
  version: string;
}

interface PackFile {
  path: string;
}

interface PackResult {
  filename: string;
  files: PackFile[];
  name: string;
  version: string;
}

interface PublishedPackage {
  directory: string;
  manifest: PackageJson;
  tarball?: string;
}

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies"
] as const;

const repositoryRoot = resolve(dirname(import.meta.filename), "..");
const packagesRoot = join(repositoryRoot, "packages");

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function run(
  command: string[],
  cwd: string
): Promise<{ stderr: string; stdout: string }> {
  const child = Bun.spawn(command, {
    cwd,
    env: process.env,
    stderr: "pipe",
    stdout: "pipe"
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text()
  ]);

  if (exitCode !== 0) {
    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    throw new Error(
      `Command failed (${exitCode}): ${command.join(" ")}\n${output}`
    );
  }

  return { stderr, stdout };
}

function collectExportTargets(value: unknown, targets = new Set<string>()) {
  if (typeof value === "string") {
    if (value.startsWith("./")) {
      targets.add(value.slice(2));
    }
    return targets;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      collectExportTargets(child, targets);
    }
    return targets;
  }

  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      collectExportTargets(child, targets);
    }
  }

  return targets;
}

function packageImportSpecifiers(manifest: PackageJson) {
  const specifiers = new Set([manifest.name]);

  if (manifest.exports && typeof manifest.exports === "object") {
    for (const key of Object.keys(manifest.exports)) {
      if (key.startsWith("./") && key !== "./package.json") {
        specifiers.add(`${manifest.name}/${key.slice(2)}`);
      }
    }
  }

  return [...specifiers];
}

async function discoverPackages(): Promise<PublishedPackage[]> {
  const directories = await readdir(packagesRoot, { withFileTypes: true });
  const packages = await Promise.all(
    directories
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const directory = join(packagesRoot, entry.name);
        const manifest = await readJson<PackageJson>(
          join(directory, "package.json")
        );
        return { directory, manifest };
      })
  );

  return packages
    .filter(({ manifest }) => !manifest.private)
    .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

function validateSourceManifests(packages: PublishedPackage[]) {
  const internalPackages = new Map(
    packages.map(({ manifest }) => [manifest.name, manifest])
  );

  for (const { manifest } of packages) {
    invariant(manifest.name, "Every publishable package must have a name");
    invariant(
      manifest.version,
      `${manifest.name} must have an explicit package version`
    );
    invariant(
      !JSON.stringify(manifest).includes('"workspace:'),
      `${manifest.name} contains a workspace: dependency that npm would publish verbatim`
    );

    for (const field of dependencyFields) {
      for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
        const internalDependency = internalPackages.get(dependency);
        if (!internalDependency) {
          continue;
        }

        let acceptsPublishedVersion = false;
        try {
          acceptsPublishedVersion = Bun.semver.satisfies(
            internalDependency.version,
            range
          );
        } catch {
          // The invariant below reports the package and invalid range.
        }
        invariant(
          range.startsWith("^") && acceptsPublishedVersion,
          `${manifest.name} ${field}.${dependency} must be a caret range that accepts ${internalDependency.version}; received ${range}`
        );
      }
    }
  }
}

async function packPackage(
  packageInfo: PublishedPackage,
  tarballDirectory: string
) {
  const { stdout } = await run(
    [
      "npm",
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      tarballDirectory,
      packageInfo.directory
    ],
    repositoryRoot
  );
  const results = JSON.parse(stdout) as PackResult[];
  const result = results[0];

  invariant(result, `npm pack did not return metadata for ${packageInfo.manifest.name}`);
  invariant(
    result.name === packageInfo.manifest.name,
    `Packed ${result.name} while expecting ${packageInfo.manifest.name}`
  );
  invariant(
    result.version === packageInfo.manifest.version,
    `${packageInfo.manifest.name} packed version ${result.version}, expected ${packageInfo.manifest.version}`
  );

  const packedFiles = new Set(result.files.map(({ path }) => path));
  const requiredFiles = new Set(["LICENSE", "README.md", "package.json"]);
  for (const target of [
    packageInfo.manifest.main,
    packageInfo.manifest.module,
    packageInfo.manifest.types
  ]) {
    if (target?.startsWith("./")) {
      requiredFiles.add(target.slice(2));
    }
  }
  for (const target of collectExportTargets(packageInfo.manifest.exports)) {
    requiredFiles.add(target);
  }
  for (const file of requiredFiles) {
    invariant(
      packedFiles.has(file),
      `${packageInfo.manifest.name} tarball is missing ${file}`
    );
  }

  const tarball = join(tarballDirectory, result.filename);
  const { stdout: packedManifestText } = await run(
    ["tar", "-xOf", tarball, "package/package.json"],
    repositoryRoot
  );
  const packedManifest = JSON.parse(packedManifestText) as PackageJson;
  invariant(
    !JSON.stringify(packedManifest).includes('"workspace:'),
    `${packageInfo.manifest.name} tarball contains a workspace: dependency`
  );
  for (const field of dependencyFields) {
    invariant(
      JSON.stringify(packedManifest[field] ?? {}) ===
        JSON.stringify(packageInfo.manifest[field] ?? {}),
      `${packageInfo.manifest.name} tarball changed ${field} while packing`
    );
  }

  packageInfo.tarball = tarball;
}

function resolvePeerInstallSpec(
  peerName: string,
  packages: PublishedPackage[],
  rootManifest: PackageJson
) {
  for (const { manifest } of packages) {
    const developmentVersion = manifest.devDependencies?.[peerName];
    if (developmentVersion) {
      return developmentVersion;
    }
  }

  return rootManifest.devDependencies?.[peerName];
}

async function createConsumer(
  manager: "bun" | "npm",
  consumerDirectory: string,
  packages: PublishedPackage[],
  rootManifest: PackageJson
) {
  const internalNames = new Set(packages.map(({ manifest }) => manifest.name));
  const dependencies: Record<string, string> = {};

  for (const packageInfo of packages) {
    invariant(
      packageInfo.tarball,
      `${packageInfo.manifest.name} was not packed before consumer creation`
    );
    dependencies[packageInfo.manifest.name] = `file:${packageInfo.tarball}`;
  }

  for (const { manifest } of packages) {
    for (const peerName of Object.keys(manifest.peerDependencies ?? {})) {
      if (internalNames.has(peerName) || dependencies[peerName]) {
        continue;
      }

      const installSpec = resolvePeerInstallSpec(peerName, packages, rootManifest);
      invariant(
        installSpec && !installSpec.startsWith("workspace:"),
        `No concrete test version is available for peer dependency ${peerName}`
      );
      dependencies[peerName] = installSpec;
    }
  }

  await mkdir(consumerDirectory, { recursive: true });
  const sortedDependencies = Object.fromEntries(
    Object.entries(dependencies).sort(([left], [right]) =>
      left.localeCompare(right)
    )
  );
  const consumerManifest = {
    dependencies: sortedDependencies,
    name: "formadapter-package-artifact-smoke",
    ...(manager === "bun"
      ? {
          // Bun resolves transitive dependencies from the registry even when a
          // matching tarball is a direct dependency. Overrides model the
          // registry versions while keeping this smoke test fully local.
          overrides: Object.fromEntries(
            Object.entries(sortedDependencies).filter(([name]) =>
              internalNames.has(name)
            )
          )
        }
      : {}),
    private: true,
    type: "module",
    version: "0.0.0"
  };
  await writeFile(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify(consumerManifest, null, 2)}\n`
  );

  const specifiers = packages.flatMap(({ manifest }) =>
    packageImportSpecifiers(manifest)
  );
  await writeFile(
    join(consumerDirectory, "verify.mjs"),
    `const specifiers = ${JSON.stringify(specifiers, null, 2)};\n\nfor (const specifier of specifiers) {\n  await import(specifier);\n}\n\nconsole.log(\`Imported \${specifiers.length} package entry points.\`);\n`
  );
}

async function verifyConsumer(
  manager: "bun" | "npm",
  directory: string
) {
  const installCommand =
    manager === "npm"
      ? ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"]
      : ["bun", "install", "--ignore-scripts"];
  await run(installCommand, directory);
  await run(manager === "npm" ? ["node", "verify.mjs"] : ["bun", "verify.mjs"], directory);
}

async function main() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "formadapter-packages-"));
  const keepTemporaryFiles = process.env.KEEP_PACKAGE_SMOKE_TEMP === "1";

  try {
    const packages = await discoverPackages();
    const rootManifest = await readJson<PackageJson>(
      join(repositoryRoot, "package.json")
    );
    invariant(packages.length > 0, "No publishable packages were found");
    validateSourceManifests(packages);

    const tarballDirectory = join(temporaryRoot, "tarballs");
    await mkdir(tarballDirectory);
    for (const packageInfo of packages) {
      await packPackage(packageInfo, tarballDirectory);
      console.log(
        `Packed ${packageInfo.manifest.name}@${packageInfo.manifest.version} (${basename(packageInfo.tarball ?? "")})`
      );
    }

    for (const manager of ["npm", "bun"] as const) {
      const consumerDirectory = join(temporaryRoot, `${manager}-consumer`);
      await createConsumer(manager, consumerDirectory, packages, rootManifest);
      await verifyConsumer(manager, consumerDirectory);
      console.log(`Verified clean ${manager} install and imports.`);
    }

    console.log(`Verified ${packages.length} publishable package artifacts.`);
  } finally {
    if (keepTemporaryFiles) {
      console.log(`Kept package smoke files at ${temporaryRoot}`);
    } else {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  }
}

await main();
