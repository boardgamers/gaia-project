import mongoose, { Schema, Types } from "mongoose";

// all in this file copied from boardgamers-mono

export interface PlayerInfo<T = string> {
  _id: T;
  remainingTime: number;
  score: number;
  dropped: boolean;
  // Not dropped but quit after someone else dropped
  quit: boolean;
  name: string;
  faction?: string;
  voteCancel?: boolean;
  ranking?: number;
  elo?: {
    initial?: number;
    delta?: number;
  };
}

export interface IAbstractGame<T = string, Game = any, GameOptions = any> {
  /** Ids of the players in the website */
  players: PlayerInfo<T>[];
  creator: T;

  currentPlayers?: Array<{
    _id: T;
    timerStart: Date;
    deadline: Date;
  }>;

  /** Game data */
  data: Game;

  context: {
    round: number;
  };

  options: {
    setup: {
      seed: string;
      nbPlayers: number;
      randomPlayerOrder: boolean;
    };
    timing: {
      timePerGame: number;
      timePerMove: number;
      /* UTC-based time of play, by default all day, during which the timer is active, in seconds */
      timer: {
        // eg 3600 = start at 1 am
        start: number;
        // eg 3600*23 = end at 11 pm
        end: number;
      };
      // The game will be cancelled if the game isn't full at this time
      scheduledStart: Date;
    };
    meta: {
      unlisted: boolean;
      minimumKarma: number;
    };
  };

  game: {
    name: string; // e.g. "gaia-project"
    version: number; // e.g. 1
    expansions: string[]; // e.g. ["spaceships"]

    options: GameOptions;
  };

  status: "open" | "pending" | "active" | "ended";
  cancelled: boolean;

  updatedAt: Date;
  createdAt: Date;
  lastMove: Date;
}

const repr = {
  _id: {
    type: String,
    trim: true,
    minlength: [2, "A game id must be at least 2 characters"] as [number, string],
    maxlength: [25, "A game id must be at most 25 characters"] as [number, string],
  },
  players: {
    type: [
      {
        _id: {
          type: Schema.Types.ObjectId,
          ref: "User",
          index: true,
        },

        name: String,
        remainingTime: Number,
        score: Number,
        dropped: Boolean,
        quit: Boolean,
        faction: String,
        voteCancel: Boolean,
        ranking: Number,
        elo: {
          initial: Number,
          delta: Number,
        },
      },
    ],
    default: () => [],
  },
  creator: {
    type: Schema.Types.ObjectId,
    index: true,
  },
  currentPlayers: [
    {
      _id: {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
      deadline: {
        type: Date,
        index: true,
      },
      timerStart: Date,
    },
  ],
  lastMove: {
    type: Date,
    index: true,
  },
  createdAt: {
    type: Date,
    index: true,
  },
  updatedAt: {
    type: Date,
    index: true,
  },
  data: {},
  status: {
    type: String,
    enum: ["open", "pending", "active", "ended"],
    default: "open",
  },
  cancelled: {
    type: Boolean,
    default: false,
  },
  options: {
    setup: {
      randomPlayerOrder: {
        type: Boolean,
        default: true,
      },
      nbPlayers: {
        type: Number,
        default: 2,
      },
      seed: {
        //this is the name
        type: String,
        trim: true,
        minlength: [2, "A game seed must be at least 2 characters"] as [number, string],
        maxlength: [25, "A game seed must be at most 25 characters"] as [number, string],
      },
    },
    timing: {
      timePerMove: {
        type: Number,
        default: 15 * 60,
        min: 0,
        max: 24 * 3600,
      },
      timePerGame: {
        type: Number,
        default: 15 * 24 * 3600,
        min: 60,
        max: 15 * 24 * 3600,
        // enum: [1 * 3600, 24 * 3600, 3 * 24 * 3600, 15 * 24 * 3600]
      },
      timer: {
        start: {
          type: Number,
          min: 0,
          max: 24 * 3600 - 1,
        },
        end: {
          type: Number,
          min: 0,
          max: 24 * 3600 - 1,
        },
      },
      scheduledStart: Date,
    },
    meta: {
      unlisted: Boolean,
      minimumKarma: Number,
    },
  },

  context: {
    round: Number,
  },

  game: {
    name: String,
    version: Number,
    expansions: [String],

    options: {},
  },
};

const schema = new Schema<GameDocument, mongoose.Model<GameDocument>>(repr);

export interface GameDocument extends mongoose.Document, IAbstractGame<Types.ObjectId> {
  _id: string;
}

export const Game = mongoose.model("Game", schema);
