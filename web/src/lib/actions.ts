import type { ActionResult, ActionType } from "./types";

export interface ActionButton {
  actionType: ActionType;
  result: ActionResult;
  label: string;
  className: string;
  /** 0-3 passer rating, only set on RECEPTION buttons */
  passRating?: number;
}

// Standard box-score actions, grouped by skill, for one-tap logging during live play.
export const ACTION_GROUPS: { title: string; buttons: ActionButton[] }[] = [
  {
    title: "Attack",
    buttons: [
      { actionType: "ATTACK", result: "SUCCESS", label: "Kill", className: "bg-emerald-600" },
      { actionType: "ATTACK", result: "ATTEMPT", label: "In Play", className: "bg-slate-500" },
      { actionType: "ATTACK", result: "BLOCKED", label: "Blocked", className: "bg-purple-600" },
      { actionType: "ATTACK", result: "ERROR", label: "Error", className: "bg-red-600" },
    ],
  },
  {
    title: "Serve",
    buttons: [
      { actionType: "SERVE", result: "SUCCESS", label: "Ace", className: "bg-emerald-600" },
      { actionType: "SERVE", result: "ATTEMPT", label: "In Play", className: "bg-slate-500" },
      { actionType: "SERVE", result: "ERROR", label: "Error", className: "bg-red-600" },
    ],
  },
  {
    title: "Reception (Passer Rating)",
    buttons: [
      { actionType: "RECEPTION", result: "SUCCESS", label: "Perfect (3)", className: "bg-emerald-600", passRating: 3 },
      { actionType: "RECEPTION", result: "SUCCESS", label: "Good (2)", className: "bg-emerald-500", passRating: 2 },
      { actionType: "RECEPTION", result: "SUCCESS", label: "Poor (1)", className: "bg-amber-600", passRating: 1 },
      { actionType: "RECEPTION", result: "ERROR", label: "Ace Against (0)", className: "bg-red-600", passRating: 0 },
    ],
  },
  {
    title: "Dig",
    buttons: [
      { actionType: "DIG", result: "SUCCESS", label: "Dig", className: "bg-emerald-600" },
      { actionType: "DIG", result: "ERROR", label: "Error", className: "bg-red-600" },
    ],
  },
  {
    title: "Block",
    buttons: [
      { actionType: "BLOCK", result: "SUCCESS", label: "Block Kill", className: "bg-emerald-600" },
      { actionType: "BLOCK", result: "ERROR", label: "Error", className: "bg-red-600" },
    ],
  },
  {
    title: "Set",
    buttons: [
      { actionType: "SET", result: "SUCCESS", label: "Assist", className: "bg-emerald-600" },
      { actionType: "SET", result: "ERROR", label: "Error", className: "bg-red-600" },
    ],
  },
];
