import {
  Armchair,
  BriefcaseBusiness,
  CodeXml,
  GraduationCap,
  Megaphone,
  Package,
  Palette,
  Smartphone,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { Tone } from "@/mocks/dashboard/types";

import type { ProductIconKey, ProductType } from "./model";

export const productIconMap: Record<ProductIconKey, LucideIcon> = {
  consulting: BriefcaseBusiness,
  development: CodeXml,
  design: Palette,
  marketing: Megaphone,
  electronics: Smartphone,
  accessories: Package,
  furniture: Armchair,
  training: GraduationCap,
  support: Wrench,
  generic_good: Package,
  generic_service: BriefcaseBusiness,
};

export const productIconTone: Record<ProductIconKey, Tone> = {
  consulting: "blue",
  development: "purple",
  design: "orange",
  marketing: "green",
  electronics: "slate",
  accessories: "blue",
  furniture: "orange",
  training: "purple",
  support: "slate",
  generic_good: "slate",
  generic_service: "blue",
};

export function iconKeyForType(type: ProductType): ProductIconKey {
  return type === "good" ? "generic_good" : "generic_service";
}
