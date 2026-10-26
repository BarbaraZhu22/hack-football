import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
export const KITS = {
    home: {
        jersey: '#78c7ea',
        sleeves: '#78c7ea',
        shorts: '#f3f0e7',
        socks: '#78c7ea',
        boots: '#111518',
        trim: '#f4fbff',
        number: '24',
        name: 'MCI',
    },
    away: {
        jersey: '#d01722',
        sleeves: '#f3f0e7',
        shorts: '#f3f0e7',
        socks: '#d01722',
        boots: '#151515',
        trim: '#ffffff',
        number: '7',
        name: 'ARS',
    },
};
function makeFabricMaterial(color, roughness = 0.78) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.01, side: THREE.DoubleSide });
}

const CLOTHING_REGIONS = [
    { material: 'socks', box: { minX: -0.29, maxX: 0.29, minY: 0.135, maxY: 0.49 } },
    { material: 'jersey', box: { minX: -0.41, maxX: 0.41, minY: 0.91, maxY: 1.58 }, excludeArms: true },
    { material: 'shorts', box: { minX: -0.43, maxX: 0.43, minY: 0.58, maxY: 0.94 } },
];

function boxPlanes(box) {
    return [
        { normal: [1, 0, 0], offset: box.minX, keepGreater: true },
        { normal: [1, 0, 0], offset: box.maxX, keepGreater: false },
        { normal: [0, 1, 0], offset: box.minY, keepGreater: true },
        { normal: [0, 1, 0], offset: box.maxY, keepGreater: false },
    ];
}

function localBonePosition(mesh, bone) {
    const position = new THREE.Vector3();
    bone.getWorldPosition(position);
    return mesh.worldToLocal(position);
}

function makeSleeveRegions(source) {
    const bones = new Map(source.skeleton.bones.map((bone) => [bone.name, bone]));
    const regions = [];
    for (const side of ['l', 'r']) {
        const upperArm = bones.get(`upperarm_${side}`);
        const elbow = bones.get(`lowerarm_${side}`);
        if (!upperArm || !elbow) continue;

        const start = localBonePosition(source, upperArm);
        const end = localBonePosition(source, elbow);
        const direction = end.sub(start);
        const armLength = direction.length();
        if (armLength < 1e-4) continue;
        direction.normalize();

        const up = new THREE.Vector3(0, 1, 0);
        let widthAxis = new THREE.Vector3().crossVectors(direction, up);
        if (widthAxis.lengthSq() < 1e-5)
            widthAxis.set(0, 0, 1).cross(direction);
        widthAxis.normalize();
        const heightAxis = new THREE.Vector3().crossVectors(widthAxis, direction).normalize();
        const halfWidth = 0.14;
        const halfHeight = 0.14;
        const sleeveStart = start.clone().addScaledVector(direction, -0.07);
        const sleeveEnd = start.clone().addScaledVector(direction, armLength * 0.58);
        const planes = [
            { normal: direction.toArray(), offset: sleeveStart.dot(direction), keepGreater: true },
            { normal: direction.toArray(), offset: sleeveEnd.dot(direction), keepGreater: false },
            { normal: widthAxis.toArray(), offset: start.dot(widthAxis) - halfWidth, keepGreater: true },
            { normal: widthAxis.toArray(), offset: start.dot(widthAxis) + halfWidth, keepGreater: false },
            { normal: heightAxis.toArray(), offset: start.dot(heightAxis) - halfHeight, keepGreater: true },
            { normal: heightAxis.toArray(), offset: start.dot(heightAxis) + halfHeight, keepGreater: false },
        ];
        regions.push({ material: 'sleeves', planes });
    }
    return regions;
}

function readVertex(index, attributes, jointSets, overrides) {
    const values = {};
    for (const [name, attribute] of attributes) {
        values[name] = Array.from({ length: attribute.itemSize }, (_, component) =>
            attribute.getComponent(index, component));
    }
    if (overrides?.position) {
        const offset = index * 3;
        values.position = [
            overrides.position[offset],
            overrides.position[offset + 1],
            overrides.position[offset + 2],
        ];
    }
    if (overrides?.normal) {
        const offset = index * 3;
        values.normal = [
            overrides.normal[offset],
            overrides.normal[offset + 1],
            overrides.normal[offset + 2],
        ];
    }
    if (values.skinIndex && values.skinWeight) {
        for (const [weightName, jointIndices] of Object.entries(jointSets ?? {})) {
            values[weightName] = values.skinIndex.reduce((sum, joint, i) =>
                sum + (jointIndices.has(joint) ? values.skinWeight[i] : 0), 0);
        }
    }
    return values;
}

function interpolateVertex(a, b, t, attributes) {
    const values = {};
    for (const [name] of attributes) {
        if (name === 'skinIndex' || name === 'skinWeight') continue;
        values[name] = a[name].map((value, i) => value + (b[name][i] - value) * t);
    }
    for (const name of Object.keys(a)) {
        if (name.endsWith('Weight') && typeof a[name] === 'number')
            values[name] = a[name] + (b[name] - a[name]) * t;
    }

    if (a.skinIndex && a.skinWeight && b.skinIndex && b.skinWeight) {
        const influences = new Map();
        for (const [vertex, scale] of [[a, 1 - t], [b, t]]) {
            for (let i = 0; i < vertex.skinIndex.length; i++) {
                const joint = vertex.skinIndex[i];
                influences.set(joint, (influences.get(joint) ?? 0) + vertex.skinWeight[i] * scale);
            }
        }
        const strongest = [...influences.entries()]
            .sort((left, right) => right[1] - left[1])
            .slice(0, a.skinIndex.length);
        const total = strongest.reduce((sum, [, weight]) => sum + weight, 0) || 1;
        values.skinIndex = new Array(a.skinIndex.length).fill(0);
        values.skinWeight = new Array(a.skinWeight.length).fill(0);
        strongest.forEach(([joint, weight], i) => {
            values.skinIndex[i] = joint;
            values.skinWeight[i] = weight / total;
        });
    }

    if (values.normal) {
        const length = Math.hypot(...values.normal) || 1;
        values.normal = values.normal.map((value) => value / length);
    }
    return values;
}

function splitPolygon(polygon, plane, attributes) {
    const inside = [];
    const outside = [];
    const distance = (vertex) => plane.attribute
        ? vertex[plane.attribute] - plane.value
        : vertex.position[0] * plane.normal[0]
            + vertex.position[1] * plane.normal[1]
            + vertex.position[2] * plane.normal[2]
            - plane.offset;
    const isInside = (vertex) => plane.keepGreater
        ? distance(vertex) >= -1e-7
        : distance(vertex) <= 1e-7;

    for (let i = 0; i < polygon.length; i++) {
        const current = polygon[i];
        const next = polygon[(i + 1) % polygon.length];
        const currentInside = isInside(current);
        const nextInside = isInside(next);
        if (currentInside) inside.push(current);
        else outside.push(current);
        if (currentInside !== nextInside) {
            const currentDistance = distance(current);
            const nextDistance = distance(next);
            const denominator = currentDistance - nextDistance;
            const t = Math.abs(denominator) < 1e-9 ? 0 : currentDistance / denominator;
            const intersection = interpolateVertex(current, next, t, attributes);
            inside.push(intersection);
            outside.push(intersection);
        }
    }
    return {
        inside: inside.length >= 3 ? inside : [],
        outside: outside.length >= 3 ? outside : [],
    };
}

function partitionByRegion(polygon, region, attributes) {
    const planes = region.planes ?? boxPlanes(region.box);
    const activePlanes = region.excludeArms
        ? [...planes, { attribute: 'armWeight', value: 0.35, keepGreater: false }]
        : planes;
    let inside = polygon;
    const outside = [];
    for (const plane of activePlanes) {
        if (!inside.length) break;
        const split = splitPolygon(inside, plane, attributes);
        if (split.outside.length) outside.push(split.outside);
        inside = split.inside;
    }
    return { inside, outside };
}

function appendPolygon(bucket, polygon, attributes, normalOffset = 0.018) {
    for (let i = 1; i < polygon.length - 1; i++) {
        for (const vertex of [polygon[0], polygon[i], polygon[i + 1]]) {
            for (const [name] of attributes) {
                const values = vertex[name].slice();
                if (name === 'position' && vertex.normal) {
                    values[0] += vertex.normal[0] * normalOffset;
                    values[1] += vertex.normal[1] * normalOffset;
                    values[2] += vertex.normal[2] * normalOffset;
                }
                bucket[name].push(...values);
            }
        }
    }
}

function makeKitMaterial(name, kit) {
    const color = name === 'sleeves' ? (kit.sleeves ?? kit.jersey) : kit[name];
    return makeFabricMaterial(color, name === 'shorts' ? 0.84 : 0.9);
}

function buildKitOverlay(source, kit) {
    const sourceGeometry = source.geometry;
    const attributes = Object.entries(sourceGeometry.attributes);
    const position = sourceGeometry.getAttribute('position');
    const sourceIndex = sourceGeometry.getIndex();
    const armNames = new Set([
        'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r',
    ]);
    const jointSets = {
        armWeight: new Set(source.skeleton.bones
            .map((bone, index) => armNames.has(bone.name) ? index : -1)
            .filter((index) => index >= 0)),
    };
    const regions = [...makeSleeveRegions(source), ...CLOTHING_REGIONS];
    const materialNames = ['jersey', 'sleeves', 'shorts', 'socks'];
    const buckets = Object.fromEntries(materialNames.map((name) => [
        name,
        Object.fromEntries(attributes.map(([attributeName]) => [attributeName, []])),
    ]));
    const triangleCount = (sourceIndex ? sourceIndex.count : position.count) / 3;

    for (let triangle = 0; triangle < triangleCount; triangle++) {
        const polygon = [0, 1, 2].map((corner) => {
            const index = sourceIndex ? sourceIndex.getX(triangle * 3 + corner) : triangle * 3 + corner;
            return readVertex(index, attributes, jointSets);
        });
        let remaining = [polygon];
        for (const region of regions) {
            const nextRemaining = [];
            for (const piece of remaining) {
                const partition = partitionByRegion(piece, region, attributes);
                if (partition.inside.length) appendPolygon(buckets[region.material], partition.inside, attributes);
                nextRemaining.push(...partition.outside);
            }
            remaining = nextRemaining;
        }
    }

    const counts = materialNames.map((name) => buckets[name].position.length / 3);
    if (!counts.some(Boolean)) return null;
    const geometry = new THREE.BufferGeometry();
    for (const [attributeName, attribute] of attributes) {
        const totalLength = Object.values(buckets).reduce((sum, bucket) => sum + bucket[attributeName].length, 0);
        const values = new attribute.array.constructor(totalLength);
        let offset = 0;
        for (const name of materialNames) {
            const current = buckets[name][attributeName];
            values.set(current, offset);
            offset += current.length;
        }
        geometry.setAttribute(attributeName, new THREE.BufferAttribute(
            values,
            attribute.itemSize,
            attribute.normalized,
        ));
    }
    let groupStart = 0;
    counts.forEach((count, materialIndex) => {
        if (count) geometry.addGroup(groupStart, count, materialIndex);
        groupStart += count;
    });
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const overlay = new THREE.SkinnedMesh(
        geometry,
        materialNames.map((name) => makeKitMaterial(name, kit)),
    );
    overlay.name = 'kit_clothing';
    overlay.castShadow = true;
    overlay.receiveShadow = false;
    overlay.frustumCulled = false;
    overlay.bindMode = source.bindMode;
    overlay.position.copy(source.position);
    overlay.quaternion.copy(source.quaternion);
    overlay.scale.copy(source.scale);
    overlay.bind(source.skeleton, source.bindMatrix);
    return overlay;
}

function buildOriginalBootMesh(source, kit) {
    const sourceGeometry = source.geometry;
    const position = sourceGeometry.getAttribute('position');
    const normal = sourceGeometry.getAttribute('normal');
    if (!position) return null;

    const selectionMinY = -0.02;
    const maxY = 0.085;
    const sourceIndex = sourceGeometry.getIndex();
    const triangleCount = (sourceIndex ? sourceIndex.count : position.count) / 3;
    const neighbors = Array.from({ length: position.count }, () => new Set());
    const candidateTriangles = [];

    for (let triangle = 0; triangle < triangleCount; triangle++) {
        const indices = [0, 1, 2].map((corner) =>
            sourceIndex ? sourceIndex.getX(triangle * 3 + corner) : triangle * 3 + corner);
        for (let corner = 0; corner < 3; corner++) {
            const a = indices[corner];
            const b = indices[(corner + 1) % 3];
            neighbors[a].add(b);
            neighbors[b].add(a);
        }

        const centerY = indices.reduce((sum, index) => sum + position.getY(index), 0) / 3;
        if (centerY >= selectionMinY && centerY <= maxY) candidateTriangles.push(indices);
    }
    if (!candidateTriangles.length) return null;

    const footBottomY = Math.min(...candidateTriangles.flatMap((indices) =>
        indices.map((index) => position.getY(index))));
    // Include the bottom-facing foot surface in the boot overlay. This keeps
    // the visible sole shoe-colored when the player lifts a foot.
    const minY = footBottomY - 0.001;
    const intersectingTriangles = candidateTriangles.filter((indices) =>
        Math.max(...indices.map((index) => position.getY(index))) >= minY);
    const selectedVertices = new Set(intersectingTriangles.flat());
    if (!intersectingTriangles.length) return null;

    // Ease the original foot surface while holding the shoe opening and sole edge in place.
    let smoothedPositions = new Float32Array(position.array);
    const pinnedVertices = new Set();
    for (const index of selectedVertices) {
        const y = position.getY(index);
        if (y < minY + 0.014 || y > maxY - 0.014
            || [...neighbors[index]].some((neighbor) => !selectedVertices.has(neighbor))) {
            pinnedVertices.add(index);
        }
    }
    for (let pass = 0; pass < 3; pass++) {
        const nextPositions = new Float32Array(smoothedPositions);
        for (const index of selectedVertices) {
            if (pinnedVertices.has(index)) continue;
            const adjacent = [...neighbors[index]].filter((neighbor) => selectedVertices.has(neighbor));
            if (!adjacent.length) continue;
            const offset = index * 3;
            const average = [0, 0, 0];
            for (const neighbor of adjacent) {
                for (let axis = 0; axis < 3; axis++) average[axis] += smoothedPositions[neighbor * 3 + axis];
            }
            for (let axis = 0; axis < 3; axis++) {
                average[axis] /= adjacent.length;
                nextPositions[offset + axis] = smoothedPositions[offset + axis] * 0.78 + average[axis] * 0.22;
            }
        }
        smoothedPositions = nextPositions;
    }

    const attributes = Object.entries(sourceGeometry.attributes);
    const bucket = Object.fromEntries(attributes.map(([name]) => [name, []]));
    const lowerPlane = { normal: [0, 1, 0], offset: minY, keepGreater: true };
    const upperPlane = { normal: [0, 1, 0], offset: maxY, keepGreater: false };
    for (const indices of intersectingTriangles) {
        const polygon = indices.map((index) => readVertex(index, attributes, null, {
            position: smoothedPositions,
        }));
        const clippedLower = splitPolygon(polygon, lowerPlane, attributes).inside;
        if (clippedLower.length < 3) continue;
        const clipped = splitPolygon(clippedLower, upperPlane, attributes).inside;
        if (clipped.length < 3) continue;
        appendPolygon(bucket, clipped, attributes, 0.018);
    }
    if (!bucket.position.length) return null;

    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of attributes) {
        const values = new attribute.array.constructor(bucket[name].length);
        values.set(bucket[name]);
        geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material = new THREE.MeshStandardMaterial({
        color: kit.boots,
        roughness: 0.38,
        metalness: 0.08,
        side: THREE.DoubleSide,
    });
    const boots = new THREE.SkinnedMesh(geometry, material);
    boots.name = 'kit_boots';
    boots.castShadow = true;
    boots.receiveShadow = false;
    boots.frustumCulled = false;
    boots.bindMode = source.bindMode;
    boots.position.copy(source.position);
    boots.quaternion.copy(source.quaternion);
    boots.scale.copy(source.scale);
    boots.bind(source.skeleton, source.bindMatrix);
    return boots;
}

/** Clone the CC0 Quaternius hero, fit it to 1.80 m and add a skin-tight kit. */
export function prepareHero(gltf, side) {
    const root = skeletonClone(gltf.scene);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const height = box.max.y - box.min.y;
    const scale = 1.8 / height;
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y = -box2.min.y;
    root.traverse((o) => {
        const m = o;
        if (m.isMesh || m.isSkinnedMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            m.frustumCulled = false;
            const mm = m.material;
            if (mm) m.material = Array.isArray(mm) ? mm.map((x) => x.clone()) : mm.clone();
            const mat = m.material;
            if (mat && 'envMapIntensity' in mat) mat.envMapIntensity = 0.5;
        }
    });
    let body = null;
    let head = null;
    root.traverse((o) => {
        const sm = o;
        if (sm.isSkinnedMesh && sm.name !== 'Eyes') {
            const mat = sm.material;
            if (mat && /Superhero|Body/i.test(mat.name)) body = sm;
            if (mat && /Hair/i.test(mat.name)) head = o;
        }
    });
    if (!body) {
        root.traverse((o) => {
            if (o.isSkinnedMesh && !body) body = o;
        });
    }
    if (!body) throw new Error('No skinned body found in hero model');

    const bodyMesh = body;
    const kit = KITS[side];
    const kitOverlay = buildKitOverlay(bodyMesh, kit);
    const overlays = kitOverlay ? [kitOverlay] : [];
    if (kitOverlay) bodyMesh.parent.add(kitOverlay);
    const boots = buildOriginalBootMesh(bodyMesh, kit);
    if (boots) {
        bodyMesh.parent.add(boots);
        overlays.push(boots);
    }
    return { scene: root, meshes: { body: bodyMesh, head, overlays } };
}
