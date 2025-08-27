import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const fishers = pgTable("fishers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nom: text("nom").notNull(),
  prenoms: text("prenoms").notNull(),
  dateNaissance: text("date_naissance").notNull(),
  telephone: text("telephone").notNull(),
  adresse: text("adresse").notNull(),
  quartierVillage: text("quartier_village").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const permits = pgTable("permits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fisherId: varchar("fisher_id").references(() => fishers.id).notNull(),
  typePeche: text("type_peche").notNull(),
  zonePeche: text("zone_peche").notNull(),
  numMaep: text("num_maep").notNull(),
  numSerie: text("num_serie").notNull().unique(),
  dateDelivrance: text("date_delivrance").notNull(),
  dateExpiration: text("date_expiration").notNull(),
  categorie: text("categorie"),
  ifuDisponible: boolean("ifu_disponible").notNull(),
  numIfu: text("num_ifu"),
  numRavip: text("num_ravip"),
  faitA: text("fait_a").notNull(),
  horodateur: timestamp("horodateur").defaultNow(),
  syncStatus: text("sync_status").default("synced"), // synced, pending, failed
});

export const vessels = pgTable("vessels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  permitId: varchar("permit_id").references(() => permits.id).notNull(),
  nomEmbarcation: text("nom_embarcation"),
  numEmbarcation: text("num_embarcation"),
  siteDebarquement: text("site_debarquement"),
  siteHabitation: text("site_habitation"),
});

export const techniques = pgTable("techniques", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  permitId: varchar("permit_id").references(() => permits.id).notNull(),
  typeEngin: text("type_engin"),
  techniquePeche: text("technique_peche"),
  especesCiblees: text("especes_ciblees"),
});

export const media = pgTable("media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  permitId: varchar("permit_id").references(() => permits.id).notNull(),
  type: text("type").notNull(), // photo_identite
  url: text("url").notNull(),
  base64Data: text("base64_data"), // For offline storage
});

export const cards = pgTable("cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  permitId: varchar("permit_id").references(() => permits.id).notNull(),
  qrPayload: text("qr_payload").notNull(),
  qrSignature: text("qr_signature").notNull(),
  pdfUrl: text("pdf_url"),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("admin"), // admin, agent
});

export const scanLogs = pgTable("scan_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cardId: varchar("card_id").references(() => cards.id),
  agentId: varchar("agent_id").references(() => users.id),
  scanDate: timestamp("scan_date").defaultNow(),
  result: text("result").notNull(), // valid, invalid, expired
  mode: text("mode").notNull(), // online, offline
});

// Insert schemas
export const insertFisherSchema = createInsertSchema(fishers).omit({
  id: true,
  createdAt: true,
});

export const insertPermitSchema = createInsertSchema(permits).omit({
  id: true,
  horodateur: true,
  syncStatus: true,
});

export const insertVesselSchema = createInsertSchema(vessels).omit({
  id: true,
});

export const insertTechniqueSchema = createInsertSchema(techniques).omit({
  id: true,
});

export const insertMediaSchema = createInsertSchema(media).omit({
  id: true,
});

export const insertCardSchema = createInsertSchema(cards).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

// Combined permit creation schema
export const createPermitSchema = z.object({
  fisher: insertFisherSchema,
  permit: insertPermitSchema,
  vessel: insertVesselSchema.optional(),
  technique: insertTechniqueSchema.optional(),
  photo: z.string().optional(), // base64 photo data
});

// Types
export type Fisher = typeof fishers.$inferSelect;
export type Permit = typeof permits.$inferSelect;
export type Vessel = typeof vessels.$inferSelect;
export type Technique = typeof techniques.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type User = typeof users.$inferSelect;
export type ScanLog = typeof scanLogs.$inferSelect;

export type InsertFisher = z.infer<typeof insertFisherSchema>;
export type InsertPermit = z.infer<typeof insertPermitSchema>;
export type InsertVessel = z.infer<typeof insertVesselSchema>;
export type InsertTechnique = z.infer<typeof insertTechniqueSchema>;
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type CreatePermit = z.infer<typeof createPermitSchema>;

// Full permit data for display
export type FullPermit = Permit & {
  fisher: Fisher;
  vessel?: Vessel;
  technique?: Technique;
  media?: Media[];
  card?: Card;
};
