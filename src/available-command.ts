import { Command } from "./enums";

export default interface AvailableCommand {
  name: Command,
  data?: any,
  player?: number
}