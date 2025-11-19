import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class GraphRenderer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Dados do grafo
        this.people = [];
        this.relationships = [];
        this.nodes = new Map(); // id -> THREE.Mesh
        this.edges = new Map(); // relationship_id -> THREE.Line
        
        // Layout de força
        this.positions = new Map(); // id -> {x, y, z}
        this.velocities = new Map(); // id -> {vx, vy, vz}
        
        // Interatividade
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredNode = null;
        this.selectedNode = null;
        
        // Callbacks
        this.onNodeClick = null;
        this.onNodeHover = null;
        
        this.init();
    }

    init() {
        // Câmera
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
        this.camera.position.set(0, 0, 100);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x0a0a0a, 1);
        this.container.appendChild(this.renderer.domElement);

        // Controles orbitais
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 500;

        // Iluminação
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight1.position.set(1, 1, 1);
        this.scene.add(directionalLight1);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
        directionalLight2.position.set(-1, -1, -1);
        this.scene.add(directionalLight2);

        // Event listeners
        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));

        // Iniciar loop de renderização
        this.animate();
    }

    setData(people, relationships) {
        this.people = people;
        this.relationships = relationships;
        this.updateGraph();
    }

    updateGraph() {
        // Limpar grafo anterior
        this.clearGraph();

        // Inicializar posições e velocidades
        this.initializeLayout();

        // Criar nós
        this.createNodes();

        // Criar arestas
        this.createEdges();

        // Aplicar layout de força
        this.applyForceLayout(100);
    }

    clearGraph() {
        // Remover nós
        this.nodes.forEach(node => {
            this.scene.remove(node);
        });
        this.nodes.clear();

        // Remover arestas
        this.edges.forEach(edge => {
            this.scene.remove(edge);
        });
        this.edges.clear();

        this.positions.clear();
        this.velocities.clear();
    }

    initializeLayout() {
        // Distribuir nós em uma esfera inicial
        const radius = Math.max(30, Math.cbrt(this.people.length) * 5);
        
        this.people.forEach((person, index) => {
            // Posição inicial em esfera
            const theta = Math.acos(2 * (index / this.people.length) - 1);
            const phi = 2 * Math.PI * index * 0.618; // Golden angle
            
            const x = radius * Math.sin(theta) * Math.cos(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(theta);

            this.positions.set(person.id, { x, y, z });
            this.velocities.set(person.id, { vx: 0, vy: 0, vz: 0 });
        });
    }

    createNodes() {
        this.people.forEach(person => {
            const pos = this.positions.get(person.id);
            
            // Criar esfera para o nó
            const geometry = new THREE.SphereGeometry(1, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                color: 0x4a9eff,
                emissive: 0x1a3a5f,
                metalness: 0.3,
                roughness: 0.7
            });
            
            const node = new THREE.Mesh(geometry, material);
            node.position.set(pos.x, pos.y, pos.z);
            node.userData = { person, type: 'node' };
            
            this.scene.add(node);
            this.nodes.set(person.id, node);
        });
    }

    createEdges() {
        this.relationships.forEach(rel => {
            const node1 = this.nodes.get(rel.person1_id);
            const node2 = this.nodes.get(rel.person2_id);
            
            if (!node1 || !node2) return;

            const pos1 = node1.position;
            const pos2 = node2.position;

            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(pos1.x, pos1.y, pos1.z),
                new THREE.Vector3(pos2.x, pos2.y, pos2.z)
            ]);

            // Cor baseada na força do relacionamento
            const intensity = rel.strength || 1.0;
            const color = new THREE.Color().lerpColors(
                new THREE.Color(0x2a4a6a),
                new THREE.Color(0x4a9eff),
                intensity
            );

            const material = new THREE.LineBasicMaterial({
                color: color,
                opacity: 0.3 + intensity * 0.4,
                transparent: true,
                linewidth: 1
            });

            const edge = new THREE.Line(geometry, material);
            edge.userData = { relationship: rel, type: 'edge' };
            
            this.scene.add(edge);
            this.edges.set(rel.id, edge);
        });
    }

    applyForceLayout(iterations = 50) {
        const k = Math.sqrt((30 * 30) / this.people.length); // Constante de força
        const repulsion = 100;
        const attraction = 0.01;
        const damping = 0.9;

        for (let iter = 0; iter < iterations; iter++) {
            // Calcular forças de repulsão entre todos os nós
            this.people.forEach(person1 => {
                const pos1 = this.positions.get(person1.id);
                const vel1 = this.velocities.get(person1.id);
                
                let fx = 0, fy = 0, fz = 0;

                // Repulsão de todos os outros nós
                this.people.forEach(person2 => {
                    if (person1.id === person2.id) return;
                    
                    const pos2 = this.positions.get(person2.id);
                    const dx = pos1.x - pos2.x;
                    const dy = pos1.y - pos2.y;
                    const dz = pos1.z - pos2.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
                    
                    const force = repulsion / (dist * dist);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                    fz += (dz / dist) * force;
                });

                // Atração das arestas conectadas
                this.relationships.forEach(rel => {
                    if (rel.person1_id === person1.id || rel.person2_id === person1.id) {
                        const otherId = rel.person1_id === person1.id ? rel.person2_id : rel.person1_id;
                        const pos2 = this.positions.get(otherId);
                        
                        const dx = pos2.x - pos1.x;
                        const dy = pos2.y - pos1.y;
                        const dz = pos2.z - pos1.z;
                        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
                        
                        const force = dist * attraction;
                        fx += (dx / dist) * force;
                        fy += (dy / dist) * force;
                        fz += (dz / dist) * force;
                    }
                });

                // Atualizar velocidade
                vel1.vx = (vel1.vx + fx) * damping;
                vel1.vy = (vel1.vy + fy) * damping;
                vel1.vz = (vel1.vz + fz) * damping;

                // Atualizar posição
                pos1.x += vel1.vx;
                pos1.y += vel1.vy;
                pos1.z += vel1.vz;
            });
        }

        // Atualizar posições dos nós e arestas
        this.updatePositions();
    }

    updatePositions() {
        // Atualizar posições dos nós
        this.nodes.forEach((node, id) => {
            const pos = this.positions.get(id);
            node.position.set(pos.x, pos.y, pos.z);
        });

        // Atualizar arestas
        this.edges.forEach((edge, relId) => {
            const rel = this.relationships.find(r => r.id === relId);
            if (!rel) return;

            const node1 = this.nodes.get(rel.person1_id);
            const node2 = this.nodes.get(rel.person2_id);
            
            if (!node1 || !node2) return;

            const geometry = edge.geometry;
            geometry.setFromPoints([
                new THREE.Vector3(node1.position.x, node1.position.y, node1.position.z),
                new THREE.Vector3(node2.position.x, node2.position.y, node2.position.z)
            ]);
            geometry.attributes.position.needsUpdate = true;
        });
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(Array.from(this.nodes.values()));

        if (intersects.length > 0) {
            const node = intersects[0].object;
            if (this.hoveredNode !== node) {
                // Remover highlight anterior
                if (this.hoveredNode) {
                    this.hoveredNode.material.emissive.setHex(0x1a3a5f);
                    this.hoveredNode.scale.set(1, 1, 1);
                }

                // Aplicar highlight
                this.hoveredNode = node;
                node.material.emissive.setHex(0x4a9eff);
                node.scale.set(1.5, 1.5, 1.5);

                if (this.onNodeHover) {
                    this.onNodeHover(node.userData.person);
                }
            }
        } else {
            if (this.hoveredNode) {
                this.hoveredNode.material.emissive.setHex(0x1a3a5f);
                this.hoveredNode.scale.set(1, 1, 1);
                this.hoveredNode = null;
            }
        }
    }

    onMouseClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(Array.from(this.nodes.values()));

        if (intersects.length > 0) {
            const node = intersects[0].object;
            
            // Remover seleção anterior
            if (this.selectedNode) {
                this.selectedNode.material.color.setHex(0x4a9eff);
            }

            // Selecionar novo nó
            this.selectedNode = node;
            node.material.color.setHex(0xffaa00);

            if (this.onNodeClick) {
                this.onNodeClick(node.userData.person);
            }
        }
    }

    highlightNode(personId, highlight = true) {
        const node = this.nodes.get(personId);
        if (!node) return;

        if (highlight) {
            node.material.emissive.setHex(0xffaa00);
            node.scale.set(2, 2, 2);
        } else {
            node.material.emissive.setHex(0x1a3a5f);
            node.scale.set(1, 1, 1);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Atualizar controles
        this.controls.update();
        
        // Renderizar
        this.renderer.render(this.scene, this.camera);
    }
}

