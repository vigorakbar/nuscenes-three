
export async function loadNuScenesLidar(binUrl: string) {
    // TODO: might be faster to load it not using fetch
    const response = await fetch(binUrl);
    const arrayBuffer = await response.arrayBuffer();

    // format per point: [x, y]
}
