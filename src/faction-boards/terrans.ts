export default {
  income: ["3k,4o,15c,q,up-gaia", "+o,k"],
  power: {
    area1: 4
  },
  handlers: {
    'discardGaia': (player, amount) => player.data.power.area2 += amount,
    'gaiaPhase-beforeTokenMove': player => {
      player.data.power.area2 += player.data.power.gaia;
      player.data.power.gaia = 0;
    }
  }
};
