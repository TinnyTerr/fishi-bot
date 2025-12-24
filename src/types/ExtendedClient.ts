import { Client, Collection } from "discord.js";
import type serverTracker from "../managers/serverTracker";

export class ExtendedClient extends Client {
    messageId = ""
    commands: Collection<string, any> = new Collection();
    servers: serverTracker[] = [];
}