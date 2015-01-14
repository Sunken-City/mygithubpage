ig.module(
        'game.entities.grep'
    )
    .requires(
        'impact.entity'
    )
    .defines(function(){
        EntityGrep = ig.Entity.extend({
            animSheet: new ig.AnimationSheet( 'media/grep.png', 90, 90 ),
            size: {x: 60, y:60},
            offset: {x: 15, y: 15},

            flip : false,
            maxVel: {x: 150, y: 300},

            gravityFactor: 0,

            type: ig.Entity.TYPE.B,
            checkAgainst: ig.Entity.TYPE.A,
            collides: ig.Entity.COLLIDES.LITE,


            init: function( x, y, settings ) {
                this.parent( x, y, settings );

                this.addAnim( 'idle', .2, [0,1] );
            },

            check: function( other ) {
                if (other instanceof EntityPlayer)
                {
                    other.receiveDamage( 10, this );
                }
            },


            update: function() {


                //this.currentAnim.flip.y = !this.flip;

                // near an edge? return!
                /*if( !ig.game.collisionMap.getTile(
                    this.pos.x + this.size.x+1,
                    this.pos.y + (this.flip ? -4 : this.size.y +4)))
                {
                    this.flip = !this.flip;
                }*/


                var ydir = this.flip ? -1 : 1;
                this.vel.y = 150 * ydir;


                // move!
                this.parent();
            },

            handleMovementTrace: function( res ) {
                this.parent( res );



                // collision with a wall? return!
                if( res.collision.y ) {
                    this.flip = !this.flip;
                }

                /*
                // jammed in ground check yo
                //if( ig.game.collisionMap.getTile(this.pos.x , (this.pos.y + this.size.y+10) ))
                if ( res.collision.y && (this.vel.y < 50))
                {

                    ig.log("adsa");
                    this.pos.y = this.last.y - 10;
                    this.pos.x = this.last.x;
                }
                 */


            }


        });
    });





