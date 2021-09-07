import { expect } from "chai";
import { deserializeFactionVariant, latestVariantVersion, serializeFactionVariant } from ".";
import { Building } from "../enums";
import { GaiaHex } from "../gaia-hex";
import Player from "../player";

describe("Faction boards", () => {
  describe("serializeFactionVariant", () => {
    it("should convert a function to a string", () => {
      const sampleFaction = {
        income: ["3k,4o,15c,q,up-eco", "+o,k,3c"],
        handlers: {
          freeActionChoice: (player, pool) => {
            if (player.data.hasPlanetaryInstitute()) {
              pool.push(["some free action"], player);
            }
          },
        },
      };
      expect(serializeFactionVariant(sampleFaction).handlers.freeActionChoice.replaceAll(" ", "")).to.deep.equal(
        `(player, pool) => {
        if (player.data.hasPlanetaryInstitute()) {
          pool.push(["some free action"], player);
        }
      }`.replaceAll(" ", "")
      );
    });
  });

  describe("deserializeFactionVariant", () => {
    it("should keep handler functions working", () => {
      const sampleFaction = {
        income: ["3k,4o,15c,q,up-eco", "+o,k,3c"],
        handlers: {
          [`build-${Building.Mine}`]: (player: Player, hex: GaiaHex) => {
            player.data.ores = 10;
          },
        },
      };

      const player = new Player();

      const deserializedFaction = deserializeFactionVariant(
        JSON.parse(JSON.stringify(serializeFactionVariant(sampleFaction)))
      );

      deserializedFaction.handlers[`build-${Building.Mine}`](player);

      expect(player.data.ores).to.equal(10);
    });
  });

  describe("latestVariantVersion", () => {
    it("shoud equal 2 for 'beta' variant", () => {
      expect(latestVariantVersion("beta")).to.equal(2);
    });

    it("shoud equal 0 for 'standard' variant", () => {
      expect(latestVariantVersion("standard")).to.equal(0);
    });
  });
});
