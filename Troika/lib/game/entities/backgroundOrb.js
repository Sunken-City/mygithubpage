/**
 * Created with JetBrains WebStorm.
 * User: Veo
 * Date: 12/14/13
 * Time: 1:06 AM
 * To change this template use File | Settings | File Templates.
 */


ig.module(
        'game.entities.backgroundOrb'
    )
    .requires(
        'impact.entity'
    )
    .defines(function(){
        EntityBackgroundOrb = ig.Entity.extend({
            animSheet: new ig.AnimationSheet( 'media/troika.png', 30, 30 ),
            size: {x: 30, y:30},
            offset: {x: 15, y:20},

            flip: false,
            maxVel: {x: 600, y: 800},
            friction: {x: 300, y: 0},

            gravityFactor: 0,

            type: ig.Entity.TYPE.NONE,
            checkAgainst: ig.Entity.TYPE.NONE,
            collides: ig.Entity.COLLIDES.NONE,

            orbitValue: 0,
            orbitSpeed: 0,
            delay: 0,

            orbValue: 0,


            init: function( x, y, settings ) {
                this.parent( x, y, settings );

                this.orbValue = settings.orbValue;
                this.delay = this.orbValue * 20;
                // Add the animations
                this.addAnim('FIRE', 1, [40] );
                this.addAnim('TOGGLE', 1, [41] );
                this.addAnim('GRAVITY', 1, [42] );
                this.addAnim('NORB', 1, [43]);

                //this.orbitValue = this.orbValue;

                if (this.orbValue  == 1)
                {
                    this.currentAnim = this.anims.FIRE;
                }
                else if (this.orbValue  == 2)
                {
                    this.currentAnim = this.anims.GRAVITY;
                }
                else if (this.orbValue  == 3)
                {
                    this.currentAnim = this.anims.TOGGLE;
                }
                this.pos.x += (50 - this.orbitValue * 30);
                this.pos.y += 75;
            },

            orbit: function() {
                if (this.delay != 0)
                {
                    this.delay--;
                    return 0;
                }
                this.orbitSpeed = Math.cos(this.orbitValue);
                this.orbitValue += 0.1;
                if (this.orbitSpeed > 0.499)
                {
                    this.zIndex = -998;
                    ig.game.sortEntitiesDeferred();
                }
                else if (this.orbitSpeed < -0.499)
                {
                    this.zIndex = -1000;
                    ig.game.sortEntitiesDeferred();
                }
            },

            update: function() {





                this.parent();

                this.orbit();

                this.pos.x += (this.orbitSpeed * 6);


                //**************************

                if (ig.game.globalVariableForOrb[ig.game.globalVariableForOrbArrayIndex]  == 'FIRE')
                {
                    if (this.orbValue  == 1)
                        this.currentAnim = this.anims.NORB;
                    if (this.orbValue  == 2)
                        this.currentAnim = this.anims.GRAVITY;
                    if (this.orbValue  == 3)
                        this.currentAnim = this.anims.TOGGLE;
                }
                else if (ig.game.globalVariableForOrb[ig.game.globalVariableForOrbArrayIndex]  == 'GRAVITY')
                {
                    if (this.orbValue  == 2)
                        this.currentAnim = this.anims.NORB;
                    if (this.orbValue  == 1)
                        this.currentAnim = this.anims.FIRE;
                    if (this.orbValue  == 3)
                        this.currentAnim = this.anims.TOGGLE;
                }
                else if (ig.game.globalVariableForOrb[ig.game.globalVariableForOrbArrayIndex]  == 'TOGGLE')
                {
                    if (this.orbValue  == 3)
                        this.currentAnim = this.anims.NORB;
                    if (this.orbValue  == 1)
                        this.currentAnim = this.anims.FIRE;
                    if (this.orbValue  == 2)
                        this.currentAnim = this.anims.GRAVITY;
                }
                else if (ig.game.globalVariableForOrb[ig.game.globalVariableForOrbArrayIndex]  == 'NONE')
                {
                    if (this.orbValue  == 1)
                        this.currentAnim = this.anims.FIRE;
                    if (this.orbValue  == 2)
                        this.currentAnim = this.anims.GRAVITY;
                    if (this.orbValue  == 3)
                        this.currentAnim = this.anims.TOGGLE;
                }

            }

        });
    });





