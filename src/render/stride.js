// Longer strides: swing the legs (and arms) further than the clip does by extrapolating
// each bone's rotation away from the standing pose.
import { character } from './character.js';

const SWING = ['thigh.L', 'thigh.R', 'upper_arm.L', 'upper_arm.R'];

// factor 1 = the clip as authored; weight = how much of the pose is walk / run right now
// kids-docs: animation.html#feet (see kids-docs/README.md)
export function stretchStride(factor, weight) {
  const t = 1 + (factor - 1) * weight;
  if (Math.abs(t - 1) < 1e-3) return;
  for (const name of SWING) {
    const b = character.bones[name];
    // slerp past 1 extrapolates: standing -> clip pose -> further along the same arc
    b.quaternion.copy(character.standing[name].clone().slerp(b.quaternion, t));
  }
}
