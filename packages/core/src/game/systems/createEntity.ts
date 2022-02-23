import * as GameAction from "../GameAction";
import * as PIXI from "pixi.js";
import * as V from "../common/Vector";
import { boidTextureByTeam, TextureId } from "../assets";
import { settings } from "../common/Settings";
import { Vector2 } from "../common/Vector";
import { LayerId, SimulationState, State, stateIsComplete } from "../State";
import { insertBoidIntoQuadTree } from "./boidQuadTree";
import { identityTransform } from "../common/Transform";

export function markEntityCreation(state: SimulationState, eid: number) {
  state.ecs.addComponent(eid, state.components.created);
  state.components.created.createdAt[eid] = state.tick;
}

export const addSprite = (
  state: State,
  eid: number,
  layer: LayerId,
  id: TextureId
) => {
  state.ecs.addComponent(eid, state.components.pixiObject);

  const sprite = new PIXI.Sprite(state.pixiTextures[id]);
  const layerContainer = state.components.pixiObject.ref[state.camera].children[
    layer
  ] as PIXI.Container;

  sprite.anchor.set(0.5, 0.5);
  layerContainer.addChild(sprite);

  state.components.pixiObject.ref[eid] = sprite;
  state.components.pixiObject.scaleBySpriteDimenssions[eid] = Number(true);
};

export const createBullet = (
  state: SimulationState,
  startFrom: number,
  velocity: number,
  lifetime: number
) => {
  const eid = state.ecs.createEntity();

  const sourceTransform = state.components.transform[startFrom];

  markEntityCreation(state, eid);

  state.ecs.addComponent(eid, state.components.transform);
  state.ecs.addComponent(eid, state.components.velocity);
  state.ecs.addComponent(eid, state.components.acceleration);
  state.ecs.addComponent(eid, state.components.bullet);
  state.ecs.addComponent(eid, state.components.mortal);

  const transform = identityTransform();
  state.components.transform[eid] = transform;
  transform.position = V.clone(sourceTransform.position);
  transform.rotation = sourceTransform.rotation;

  state.components.velocity[eid].x =
    Math.cos(sourceTransform.rotation) * velocity;
  state.components.velocity[eid].y =
    Math.sin(sourceTransform.rotation) * velocity;
  state.components.mortal.lifetime[eid] = lifetime;

  state.tickScheduler.schedule(
    state.tick + lifetime,
    GameAction.despawnEntity(eid)
  );

  if (stateIsComplete(state)) {
    addSprite(state, eid, LayerId.BulletLayer, TextureId.BlueBullet);
  }

  return eid;
};

export function limitSpeed(state: SimulationState, eid: number, to: number) {
  state.components.speedLimit[eid] = to;
}

export function createBoid(
  state: SimulationState,
  position: Vector2,
  team: number
) {
  const eid = state.ecs.createEntity();

  state.ecs.addComponent(eid, state.components.transform);
  state.ecs.addComponent(eid, state.components.acceleration);
  state.ecs.addComponent(eid, state.components.velocity);
  state.ecs.addComponent(eid, state.components.physicsObject);

  state.ecs.addComponent(eid, state.components.speedLimit);
  state.ecs.addComponent(eid, state.components.boidAlignment);
  state.ecs.addComponent(eid, state.components.boidCohesion);
  state.ecs.addComponent(eid, state.components.boidSeparation);
  state.ecs.addComponent(eid, state.components.pathFollowingBehavior);

  state.ecs.addComponent(eid, state.components.rotateAfterVelocity);
  state.ecs.addComponent(eid, state.components.team);

  // Position
  const transform = identityTransform();

  transform.scale.x = 15;
  transform.scale.y = 15;

  state.components.transform[eid] = transform;
  V.cloneInto(transform.position, position);

  limitSpeed(state, eid, settings.maxBoidVelocity);

  state.components.velocity[eid] = V.origin();

  // Mass & team
  state.components.physicsObject.mass[eid] = 1;
  state.components.team[eid] = team;
  state.components.pathFollowingBehavior.path[eid] = team;

  // TODO: automate this process?
  insertBoidIntoQuadTree(state, eid, team);

  if (stateIsComplete(state)) {
    addSprite(state, eid, LayerId.BulletLayer, boidTextureByTeam[team]);
  }

  return eid;
}
