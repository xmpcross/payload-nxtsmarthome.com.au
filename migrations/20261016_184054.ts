import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_site_settings_heading_font" AS ENUM('inter', 'urbanist', 'outfit');
    CREATE TYPE "public"."enum_site_settings_body_font" AS ENUM('inter', 'urbanist', 'outfit');
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "heading_font" "enum_site_settings_heading_font" DEFAULT 'inter';
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "body_font" "enum_site_settings_body_font" DEFAULT 'inter';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "heading_font";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "body_font";
    DROP TYPE IF EXISTS "public"."enum_site_settings_heading_font";
    DROP TYPE IF EXISTS "public"."enum_site_settings_body_font";
  `)
}
