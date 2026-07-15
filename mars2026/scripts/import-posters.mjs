import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BUCKET = "poster-preview-images";

function loadDotEnv(contents) {
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");
    process.env[key] ??= value;
  }
}

async function loadLocalEnv() {
  try {
    const envContents = await readFile(".env.local", "utf8");
    loadDotEnv(envContents);
  } catch {
    // The script can also be run with environment variables supplied directly.
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  throw new Error(`Unsupported image extension for ${filePath}`);
}

function storagePathForPoster(poster) {
  const fileName = poster.storageName ?? path.basename(poster.imagePath);
  return `${poster.slug}/${fileName}`;
}

function normalizeStoragePath(storagePath) {
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    throw new Error("storagePath should be the path inside the bucket, not a full URL");
  }

  return storagePath.replace(/^\/+/, "");
}

function publicUrlForStoragePath(supabase, bucket, storagePath) {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(normalizeStoragePath(storagePath));
  return data.publicUrl;
}

async function uploadPosterImage(supabase, bucket, poster) {
  const imageBuffer = await readFile(poster.imagePath);
  const storagePath = storagePathForPoster(poster);

  const { error } = await supabase.storage.from(bucket).upload(storagePath, imageBuffer, {
    contentType: contentTypeFor(poster.imagePath),
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload ${poster.imagePath}: ${error.message}`);
  }

  return publicUrlForStoragePath(supabase, bucket, storagePath);
}

async function resolvePosterImageUrl(supabase, bucket, poster) {
  if (poster.imagePath) {
    return uploadPosterImage(supabase, bucket, poster);
  }

  return publicUrlForStoragePath(supabase, bucket, poster.storagePath);
}

async function upsertPoster(supabase, poster, imageUrl) {
  const { data, error } = await supabase
    .from("posters")
    .upsert(
      {
        title: poster.title,
        slug: poster.slug,
        description: poster.description ?? null,
        collection: poster.collection ?? null,
        image_url: imageUrl,
        status: poster.status ?? "draft",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to upsert poster ${poster.slug}: ${error.message}`);
  }

  return data.id;
}

async function upsertVariant(supabase, posterId, variant) {
  const variantPayload = {
    poster_id: posterId,
    sku: variant.sku,
    width_in: variant.widthIn,
    height_in: variant.heightIn,
    paper_type: variant.paperType,
    price_cents: variant.priceCents,
    currency: variant.currency ?? "usd",
    stripe_price_id: variant.stripePriceId ?? null,
    is_active: variant.isActive ?? true,
    production_notes: variant.productionNotes ?? null,
    label: variant.label,
  };

  const { data: existingVariant, error: existingVariantError } = await supabase
    .from("variants")
    .select("id")
    .eq("sku", variant.sku)
    .maybeSingle();

  if (existingVariantError) {
    throw new Error(`Failed to look up variant ${variant.sku}: ${existingVariantError.message}`);
  }

  const query = existingVariant
    ? supabase.from("variants").update(variantPayload).eq("id", existingVariant.id)
    : supabase.from("variants").insert(variantPayload);

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to upsert variant ${variant.sku}: ${error.message}`);
  }
}

function validatePoster(poster) {
  const requiredPosterFields = ["title", "slug", "variants"];
  for (const field of requiredPosterFields) {
    if (!poster[field]) {
      throw new Error(`Poster is missing required field: ${field}`);
    }
  }

  if (!poster.imagePath && !poster.storagePath) {
    throw new Error(`Poster ${poster.slug} needs imagePath or storagePath`);
  }

  if (!Array.isArray(poster.variants) || poster.variants.length === 0) {
    throw new Error(`Poster ${poster.slug} must include at least one variant`);
  }

  for (const variant of poster.variants) {
    const requiredVariantFields = [
      "sku",
      "label",
      "widthIn",
      "heightIn",
      "paperType",
      "priceCents",
    ];

    for (const field of requiredVariantFields) {
      if (!variant[field]) {
        throw new Error(`Variant for poster ${poster.slug} is missing required field: ${field}`);
      }
    }
  }
}

async function importPoster(supabase, bucket, poster) {
  validatePoster(poster);

  const imageUrl = await resolvePosterImageUrl(supabase, bucket, poster);
  const posterId = await upsertPoster(supabase, poster, imageUrl);

  for (const variant of poster.variants) {
    await upsertVariant(supabase, posterId, variant);
  }

  console.log(`Imported ${poster.slug} with ${poster.variants.length} variants`);
}

async function main() {
  await loadLocalEnv();

  const manifestPath = process.argv[2];
  if (!manifestPath) {
    throw new Error("Usage: node scripts/import-posters.mjs data/posters.json");
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const posters = manifest.posters ?? [];
  const bucket = manifest.bucket ?? DEFAULT_BUCKET;

  if (!Array.isArray(posters) || posters.length === 0) {
    throw new Error("Manifest must include a non-empty posters array");
  }

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
      },
    },
  );

  for (const poster of posters) {
    await importPoster(supabase, bucket, poster);
  }

  console.log(`Done. Imported ${posters.length} posters.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
