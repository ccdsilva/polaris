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
        
        // Agrupamento por características
        this.userCharacteristics = new Map(); // id -> characteristics
        this.userGroups = new Map(); // id -> groupId
        this.groupCenters = new Map(); // groupId -> {x, y, z}
        
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
        this.controls.dampingFactor = 0.1;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;
        this.controls.enableRotate = true;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 1000;
        this.controls.rotateSpeed = 0.5;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;
        this.controls.screenSpacePanning = false;
        this.controls.target.set(0, 0, 0); // Foco inicial no centro

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
        
        // Controles de teclado para navegação
        this.setupKeyboardControls();

        // Iniciar loop de renderização
        this.animate();
    }
    
    setupKeyboardControls() {
        this.keys = {};
        
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.handleKeyboardInput();
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }
    
    handleKeyboardInput() {
        if (!this.controls) return;
        
        const speed = 2;
        const target = this.controls.target;
        
        // Setas ou WASD para mover a câmera
        if (this.keys['arrowleft'] || this.keys['a']) {
            target.x -= speed;
        }
        if (this.keys['arrowright'] || this.keys['d']) {
            target.x += speed;
        }
        if (this.keys['arrowup'] || this.keys['w']) {
            target.y += speed;
        }
        if (this.keys['arrowdown'] || this.keys['s']) {
            target.y -= speed;
        }
        
        // Q e E para zoom
        if (this.keys['q'] || this.keys['pageup']) {
            this.camera.position.multiplyScalar(0.95);
        }
        if (this.keys['e'] || this.keys['pagedown']) {
            this.camera.position.multiplyScalar(1.05);
        }
        
        // R para resetar câmera
        if (this.keys['r']) {
            this.centerCamera();
        }
        
        // Espaço para focar no nó selecionado
        if (this.keys[' '] && this.selectedNode) {
            const personId = this.selectedNode.userData.person.id;
            this.focusOnNode(personId);
        }
        
        this.controls.update();
    }

    setData(people, relationships) {
        this.people = people;
        this.relationships = relationships;
        this.updateGraph();
    }

    updateGraph() {
        // Limpar grafo anterior
        this.clearGraph();

        // Calcular características dos usuários
        this.calculateUserCharacteristics();

        // Agrupar usuários por características similares
        this.groupUsersByCharacteristics();

        // Inicializar posições e velocidades (agrupadas)
        this.initializeLayout();

        // Criar nós (com cores e formatos baseados em grupos)
        this.createNodes();

        // Criar arestas
        this.createEdges();

        // Aplicar layout de força (com atração entre grupos)
        this.applyForceLayout(100);
        
        // Centralizar câmera após criar o grafo
        setTimeout(() => {
            this.centerCamera();
        }, 100);
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
        this.userCharacteristics.clear();
        this.userGroups.clear();
        this.groupCenters.clear();
    }

    // Calcular características de cada usuário
    calculateUserCharacteristics() {
        this.people.forEach(person => {
            // Contar relacionamentos por tipo e classificação
            const relCounts = {
                familiar: 0, socio_criminal: 0, contato_suspeito: 0, conhecido: 0,
                associado: 0, lideranca: 0, subordinado: 0, rival: 0
            };
            const classificationCounts = {
                intra_faccao: 0,
                inter_faccao: 0,
                faccao_civil: 0,
                civil: 0,
                normal: 0
            };
            
            let totalStrength = 0;
            let connectionCount = 0;
            let intraFaccaoCount = 0;
            
            this.relationships.forEach(rel => {
                if (rel.person1_id === person.id || rel.person2_id === person.id) {
                    connectionCount++;
                    totalStrength += rel.strength || 0.5;
                    const relType = rel.relationship_type || 'conhecido';
                    if (relCounts.hasOwnProperty(relType)) {
                        relCounts[relType]++;
                    }
                    
                    const classification = rel.classification || 'normal';
                    if (classificationCounts.hasOwnProperty(classification)) {
                        classificationCounts[classification]++;
                    }
                    
                    if (classification === 'intra_faccao') {
                        intraFaccaoCount++;
                    }
                }
            });

            // Tipo de relacionamento predominante
            const dominantType = Object.keys(relCounts).reduce((a, b) => 
                relCounts[a] > relCounts[b] ? a : b
            );

            // Força média dos relacionamentos
            const avgStrength = connectionCount > 0 ? totalStrength / connectionCount : 0;

            // Domínio do email
            const emailDomain = person.email ? person.email.split('@')[1] : 'unknown';

            // Grau do nó (número de conexões)
            const degree = connectionCount;

            // Categoria de grau (baixo, médio, alto)
            const degreeCategory = degree < 3 ? 'low' : degree < 7 ? 'medium' : 'high';

            // Facção (prioridade para agrupamento)
            const faccao = person.faccao || 'civil';
            const riskLevel = person.risk_level || 'baixo';

            this.userCharacteristics.set(person.id, {
                dominantType,
                avgStrength,
                emailDomain,
                degree,
                degreeCategory,
                relCounts,
                faccao,
                riskLevel,
                intraFaccaoCount,
                classificationCounts
            });
        });
    }

    // Agrupar usuários por características similares (priorizando facções)
    groupUsersByCharacteristics() {
        const groups = new Map();
        let nextGroupId = 0;

        // Criar grupos baseados em facção primeiro (mais importante para segurança pública)
        // Depois por tipo de relacionamento dominante e categoria de grau
        this.people.forEach(person => {
            const chars = this.userCharacteristics.get(person.id);
            
            // Prioridade 1: Facção (agrupa por facção)
            // Prioridade 2: Tipo de relacionamento dominante
            // Prioridade 3: Categoria de grau
            const groupKey = `${chars.faccao}_${chars.dominantType}_${chars.degreeCategory}`;
            
            if (!groups.has(groupKey)) {
                groups.set(groupKey, nextGroupId++);
            }
            
            this.userGroups.set(person.id, groups.get(groupKey));
        });

        // Calcular centros dos grupos para posicionamento inicial
        groups.forEach((groupId, groupKey) => {
            const groupMembers = Array.from(this.userGroups.entries())
                .filter(([_, gid]) => gid === groupId)
                .map(([id, _]) => id);

            if (groupMembers.length > 0) {
                // Calcular centro do grupo
                const center = { x: 0, y: 0, z: 0 };
                groupMembers.forEach(id => {
                    const pos = this.positions.get(id);
                    if (pos) {
                        center.x += pos.x;
                        center.y += pos.y;
                        center.z += pos.z;
                    }
                });
                center.x /= groupMembers.length;
                center.y /= groupMembers.length;
                center.z /= groupMembers.length;
                
                this.groupCenters.set(groupId, center);
            }
        });
    }

    initializeLayout() {
        // Primeiro, calcular características e grupos
        if (this.userGroups.size === 0) {
            this.calculateUserCharacteristics();
            this.groupUsersByCharacteristics();
        }

        // Distribuir grupos em posições iniciais
        const numGroups = Math.max(1, new Set(this.userGroups.values()).size);
        const groupRadius = Math.max(20, Math.cbrt(numGroups) * 8);
        
        // Posições dos grupos
        const groupPositions = new Map();
        let groupIndex = 0;
        const processedGroups = new Set();
        
        this.userGroups.forEach((groupId, personId) => {
            if (!processedGroups.has(groupId)) {
                processedGroups.add(groupId);
                
                const theta = Math.acos(2 * (groupIndex / numGroups) - 1);
                const phi = 2 * Math.PI * groupIndex * 0.618;
                
                const x = groupRadius * Math.sin(theta) * Math.cos(phi);
                const y = groupRadius * Math.sin(theta) * Math.sin(phi);
                const z = groupRadius * Math.cos(theta);
                
                groupPositions.set(groupId, { x, y, z });
                this.groupCenters.set(groupId, { x, y, z });
                groupIndex++;
            }
        });

        // Distribuir nós próximos ao centro do seu grupo
        this.people.forEach((person, index) => {
            const groupId = this.userGroups.get(person.id);
            const groupCenter = groupPositions.get(groupId) || { x: 0, y: 0, z: 0 };
            
            // Adicionar variação aleatória pequena ao redor do centro do grupo
            const spread = 5; // Raio de espalhamento dentro do grupo
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = Math.random() * Math.PI;
            const r = Math.random() * spread;
            
            const x = groupCenter.x + r * Math.sin(angle2) * Math.cos(angle1);
            const y = groupCenter.y + r * Math.sin(angle2) * Math.sin(angle1);
            const z = groupCenter.z + r * Math.cos(angle2);

            this.positions.set(person.id, { x, y, z });
            this.velocities.set(person.id, { vx: 0, vy: 0, vz: 0 });
        });
    }

    createNodes() {
        // Cores por facção (prioridade para segurança pública)
        const faccaoColors = {
            'PCC': 0xff0000,           // Vermelho
            'CV': 0xff6b00,            // Laranja
            'ADA': 0x9b59b6,           // Roxo
            'TCP': 0xe74c3c,           // Vermelho claro
            'Família do Norte': 0x3498db, // Azul
            'civil': 0x4a9eff,         // Azul claro (civis)
            null: 0x95a5a6            // Cinza (sem facção)
        };

        // Cores por tipo de relacionamento dominante (fallback)
        const typeColors = {
            familiar: 0x51cf66,        // Verde
            socio_criminal: 0xff0000,  // Vermelho
            contato_suspeito: 0xff6b00, // Laranja
            conhecido: 0x4a9eff,       // Azul
            associado: 0x9b59b6,      // Roxo
            lideranca: 0xe74c3c,      // Vermelho claro
            subordinado: 0x3498db,    // Azul escuro
            rival: 0xff0000           // Vermelho
        };

        // Formatos por categoria de grau
        const createGeometry = (degreeCategory) => {
            switch(degreeCategory) {
                case 'low':
                    return new THREE.SphereGeometry(0.8, 12, 12);
                case 'medium':
                    return new THREE.BoxGeometry(1.2, 1.2, 1.2);
                case 'high':
                    return new THREE.OctahedronGeometry(1.0);
                default:
                    return new THREE.SphereGeometry(1, 16, 16);
            }
        };

        // Cores por domínio de email (variação de tom)
        const getEmailDomainColor = (baseColor, emailDomain) => {
            const domainHash = emailDomain.split('').reduce((acc, char) => 
                acc + char.charCodeAt(0), 0);
            const variation = (domainHash % 30) - 15; // Variação de -15 a +15
            
            const color = new THREE.Color(baseColor);
            const hsl = { h: 0, s: 0, l: 0 };
            color.getHSL(hsl);
            
            // Ajustar luminosidade baseado no domínio
            hsl.l = Math.max(0.3, Math.min(0.8, hsl.l + variation / 100));
            return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
        };

        this.people.forEach(person => {
            const pos = this.positions.get(person.id);
            const chars = this.userCharacteristics.get(person.id);
            
            if (!chars) {
                // Fallback se não houver características
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
                return;
            }

            // Formato baseado na categoria de grau
            const geometry = createGeometry(chars.degreeCategory);
            
            // Cor base baseada na FACÇÃO (prioridade para segurança pública)
            let baseColor = faccaoColors[chars.faccao] || faccaoColors['civil'] || 0x4a9eff;
            
            // Se não tem facção, usar tipo de relacionamento dominante
            if (!chars.faccao || chars.faccao === 'civil') {
                baseColor = typeColors[chars.dominantType] || baseColor;
            }
            
            // Ajustar cor baseado no nível de risco (mais risco = mais intenso)
            const riskMultiplier = {
                'baixo': 1.0,
                'medio': 1.2,
                'alto': 1.4,
                'critico': 1.6
            };
            const multiplier = riskMultiplier[chars.riskLevel] || 1.0;
            const color = new THREE.Color(baseColor);
            color.multiplyScalar(Math.min(multiplier, 1.5));
            
            // Ajustar cor baseado no domínio de email (variação sutil)
            const finalColor = getEmailDomainColor(color.getHex(), chars.emailDomain);
            
            // Tamanho baseado no grau e nível de risco
            // Pessoas com mais conexões e maior risco são maiores
            const riskSizeBonus = {
                'baixo': 0,
                'medio': 0.1,
                'alto': 0.2,
                'critico': 0.3
            };
            const sizeBonus = riskSizeBonus[chars.riskLevel] || 0;
            const scale = 0.7 + (chars.degree / 15) * 0.5 + sizeBonus; // Entre 0.7 e 1.5
            
            // Emissão mais intensa para pessoas de alto risco
            const emissiveIntensity = {
                'baixo': 0.1,
                'medio': 0.2,
                'alto': 0.4,
                'critico': 0.6
            };
            const emissive = emissiveIntensity[chars.riskLevel] || 0.2;
            
            const material = new THREE.MeshStandardMaterial({
                color: finalColor,
                emissive: finalColor.clone().multiplyScalar(emissive),
                metalness: chars.riskLevel === 'critico' ? 0.8 : 0.3,
                roughness: chars.riskLevel === 'critico' ? 0.2 : 0.7
            });
            
            const node = new THREE.Mesh(geometry, material);
            node.scale.set(scale, scale, scale);
            node.position.set(pos.x, pos.y, pos.z);
            node.userData = { 
                person, 
                type: 'node',
                groupId: this.userGroups.get(person.id),
                characteristics: chars,
                originalScale: scale,
                originalColor: finalColor.clone() // Guardar cor original
            };
            
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

            // Cor baseada na classificação do relacionamento (prioridade para segurança pública)
            const classification = rel.classification || 'normal';
            let baseColor;
            let lineWidth = 1;
            
            switch(classification) {
                case 'intra_faccao':
                    baseColor = 0xff0000; // Vermelho - dentro da facção
                    lineWidth = 2;
                    break;
                case 'inter_faccao':
                    baseColor = 0xff6b00; // Laranja - entre facções rivais
                    lineWidth = 2;
                    break;
                case 'faccao_civil':
                    baseColor = 0xffd93d; // Amarelo - facção com civil
                    lineWidth = 1.5;
                    break;
                case 'civil':
                    baseColor = 0x4a9eff; // Azul - entre civis
                    lineWidth = 1;
                    break;
                default:
                    baseColor = 0x2a4a6a; // Cinza - normal
                    lineWidth = 1;
            }

            // Ajustar cor pela força do relacionamento
            const intensity = rel.strength || 1.0;
            const color = new THREE.Color().lerpColors(
                new THREE.Color(baseColor).multiplyScalar(0.5),
                new THREE.Color(baseColor),
                intensity
            );

            // Opacidade baseada na força e classificação
            let opacity = 0.3 + intensity * 0.4;
            if (classification === 'intra_faccao' || classification === 'inter_faccao') {
                opacity = Math.min(0.9, opacity + 0.2); // Mais visível para vínculos críticos
            }

            const material = new THREE.LineBasicMaterial({
                color: color,
                opacity: opacity,
                transparent: true,
                linewidth: lineWidth
            });

            const edge = new THREE.Line(geometry, material);
            edge.userData = { relationship: rel, type: 'edge' };
            
            this.scene.add(edge);
            this.edges.set(rel.id, edge);
        });
    }

    applyForceLayout(iterations = 50) {
        const k = Math.sqrt((30 * 30) / this.people.length); // Constante de força
        const repulsion = 80;
        const attraction = 0.01;
        const groupAttraction = 0.05; // Força adicional para atrair nós do mesmo grupo
        const damping = 0.9;

        for (let iter = 0; iter < iterations; iter++) {
            // Atualizar centros dos grupos
            this.updateGroupCenters();

            // Calcular forças de repulsão entre todos os nós
            this.people.forEach(person1 => {
                const pos1 = this.positions.get(person1.id);
                const vel1 = this.velocities.get(person1.id);
                const groupId1 = this.userGroups.get(person1.id);
                
                let fx = 0, fy = 0, fz = 0;

                // Repulsão de todos os outros nós
                this.people.forEach(person2 => {
                    if (person1.id === person2.id) return;
                    
                    const pos2 = this.positions.get(person2.id);
                    const dx = pos1.x - pos2.x;
                    const dy = pos1.y - pos2.y;
                    const dz = pos1.z - pos2.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
                    
                    // Menos repulsão se forem do mesmo grupo
                    const groupId2 = this.userGroups.get(person2.id);
                    const sameGroup = groupId1 === groupId2;
                    const repulsionForce = sameGroup ? repulsion * 0.5 : repulsion;
                    
                    const force = repulsionForce / (dist * dist);
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

                // Atração ao centro do grupo (para manter grupos coesos)
                if (this.groupCenters.has(groupId1)) {
                    const groupCenter = this.groupCenters.get(groupId1);
                    const dx = groupCenter.x - pos1.x;
                    const dy = groupCenter.y - pos1.y;
                    const dz = groupCenter.z - pos1.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
                    
                    // Força proporcional à distância do centro (mantém grupo junto)
                    const force = dist * groupAttraction;
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                    fz += (dz / dist) * force;
                }

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
        
        // Centralizar câmera após layout
        this.centerCamera();
    }
    
    // Calcular centro do grafo e centralizar câmera
    centerCamera() {
        if (this.people.length === 0) return;
        
        // Calcular bounding box de todos os nós
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        this.positions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
            minZ = Math.min(minZ, pos.z);
            maxZ = Math.max(maxZ, pos.z);
        });
        
        // Calcular centro
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        
        // Calcular tamanho do grafo
        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;
        const maxSize = Math.max(sizeX, sizeY, sizeZ, 1);
        
        // Ajustar target dos controles para o centro
        this.controls.target.set(centerX, centerY, centerZ);
        
        // Posicionar câmera a uma distância adequada
        const distance = maxSize * 1.5;
        this.camera.position.set(
            centerX + distance * 0.5,
            centerY + distance * 0.5,
            centerZ + distance * 0.7
        );
        
        // Atualizar controles
        this.controls.update();
    }
    
    // Focar câmera em um nó específico
    focusOnNode(personId, duration = 1000) {
        const node = this.nodes.get(personId);
        if (!node) return;
        
        const targetPosition = node.position.clone();
        const currentTarget = this.controls.target.clone();
        
        // Calcular distância atual
        const currentDistance = this.camera.position.distanceTo(currentTarget);
        const newDistance = Math.max(30, currentDistance * 0.6);
        
        // Calcular posição da câmera (olhando para o nó)
        const direction = new THREE.Vector3(0.5, 0.5, 1).normalize();
        const newCameraPosition = targetPosition.clone().add(
            direction.multiplyScalar(newDistance)
        );
        
        // Animação suave
        const startTime = Date.now();
        const startCameraPos = this.camera.position.clone();
        const startTarget = currentTarget.clone();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease in-out)
            const ease = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // Interpolar posição da câmera
            this.camera.position.lerpVectors(startCameraPos, newCameraPosition, ease);
            
            // Interpolar target
            this.controls.target.lerpVectors(startTarget, targetPosition, ease);
            this.controls.update();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    updateGroupCenters() {
        // Recalcular centros dos grupos baseado nas posições atuais
        const groupPositions = new Map();
        const groupCounts = new Map();

        this.people.forEach(person => {
            const groupId = this.userGroups.get(person.id);
            const pos = this.positions.get(person.id);
            
            if (!groupPositions.has(groupId)) {
                groupPositions.set(groupId, { x: 0, y: 0, z: 0 });
                groupCounts.set(groupId, 0);
            }
            
            const center = groupPositions.get(groupId);
            center.x += pos.x;
            center.y += pos.y;
            center.z += pos.z;
            groupCounts.set(groupId, groupCounts.get(groupId) + 1);
        });

        // Calcular médias
        groupPositions.forEach((center, groupId) => {
            const count = groupCounts.get(groupId);
            center.x /= count;
            center.y /= count;
            center.z /= count;
            this.groupCenters.set(groupId, center);
        });
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

                // Aplicar highlight (preservar cor original)
                this.hoveredNode = node;
                const originalColor = node.material.color.clone();
                node.material.emissive.copy(originalColor.multiplyScalar(0.5));
                const originalScale = node.userData.originalScale || 1;
                node.scale.set(originalScale * 1.5, originalScale * 1.5, originalScale * 1.5);

                if (this.onNodeHover) {
                    this.onNodeHover(node.userData.person);
                }
            }
        } else {
            if (this.hoveredNode) {
                const originalColor = this.hoveredNode.material.color.clone();
                this.hoveredNode.material.emissive.copy(originalColor.multiplyScalar(0.2));
                const originalScale = this.hoveredNode.userData.originalScale || 1;
                this.hoveredNode.scale.set(originalScale, originalScale, originalScale);
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
            if (this.selectedNode && this.selectedNode !== node) {
                const originalColor = this.selectedNode.userData.originalColor || new THREE.Color(0x4a9eff);
                this.selectedNode.material.color.copy(originalColor);
            }

            // Selecionar novo nó
            this.selectedNode = node;
            
            // Guardar cor original se não tiver
            if (!node.userData.originalColor) {
                node.userData.originalColor = node.material.color.clone();
            }
            
            node.material.color.setHex(0xffaa00);
            
            // Focar no nó selecionado (duplo clique para zoom)
            if (event.detail === 2) {
                this.focusOnNode(node.userData.person.id);
            }

            if (this.onNodeClick) {
                this.onNodeClick(node.userData.person);
            }
        } else {
            // Clique fora - deselecionar
            if (this.selectedNode) {
                const originalColor = this.selectedNode.userData.originalColor || new THREE.Color(0x4a9eff);
                this.selectedNode.material.color.copy(originalColor);
                this.selectedNode = null;
            }
        }
    }

    highlightNode(personId, highlight = true) {
        const node = this.nodes.get(personId);
        if (!node) return;

        if (highlight) {
            const originalColor = node.material.color.clone();
            node.material.emissive.copy(originalColor.multiplyScalar(0.8));
            const originalScale = node.userData.originalScale || 1;
            node.scale.set(originalScale * 2, originalScale * 2, originalScale * 2);
        } else {
            const originalColor = node.material.color.clone();
            node.material.emissive.copy(originalColor.multiplyScalar(0.2));
            const originalScale = node.userData.originalScale || 1;
            node.scale.set(originalScale, originalScale, originalScale);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Atualizar controles (com damping)
        this.controls.update();
        
        // Processar entrada de teclado contínua
        if (this.keys) {
            this.handleKeyboardInput();
        }
        
        // Renderizar
        this.renderer.render(this.scene, this.camera);
    }
    
    // Método público para focar em pessoa por ID
    focusOnPerson(personId) {
        this.focusOnNode(personId);
    }
}

