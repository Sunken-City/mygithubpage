
ig.module(
        'game.entities.zweiDialog'
    )
    .requires(
        'impact.entity', 'impact.game'
    )
    .defines(function(){






        //************************************************
        //********************************************************

        EntityZweiDialog = ig.Entity.extend({


            size: {x: 550 , y:100},
            //offset: {x:15, y:30},
            flip: true,


            gravityFactor: 0,


            type: ig.Entity.TYPE.NONE,
            checkAgainst: ig.Entity.TYPE.NONE,
            collides:   ig.Entity.COLLIDES.NEVER,


          zweiFont : null,
          troikaFont : null,

          dialogTimer : new ig.Timer(),



            init: function(x,y) {


                this.pos.x = x;
                this.pos.y = y;


                this.parent( );



                this.zweiFont = new ig.Font( 'media/ZweiFont.png' );
                this.troikaFont = new ig.Font( 'media/TroikaFont.png' );


                this.zIndex = 1000;	// always show on top


               // this.dialogTimer = new ig.Timer();


            },


            update: function() {




                this.parent();
            },


            draw: function() {

                this.parent();



                this.zweiFont.draw(  "[[END]]", 400, 350, ig.Font.ALIGN.LEFT);

               /*
                if ( this.dialogTimer.delta() < 4)
                {
                    this.zweiFont.draw(  "Troika... you came for me?", 200, 300, ig.Font.ALIGN.LEFT);
                }
                else if ( this.dialogTimer.delta() < 7)
                {
                    this.troikaFont.draw(  "Of course I did.", 200, 300, ig.Font.ALIGN.LEFT);
                    this.troikaFont.draw(  "Why wouldn't I?", 200, 330, ig.Font.ALIGN.LEFT);

                }
                else if ( this.dialogTimer.delta() < 13)
                {
                    this.zweiFont.draw(  "But, I'm so...", 350, 300, ig.Font.ALIGN.LEFT);

                }
                else if ( this.dialogTimer.delta() < 14)
                {
                    this.troikaFont.draw(  "No, Zwei. You're the only one.", 200, 300, ig.Font.ALIGN.LEFT);

                }
                else if ( this.dialogTimer.delta() < 16 || (this.dialogTimer.delta() < 16 ) )
                {
                    this.zweiFont.draw(  "[[END]]", 400, 350, ig.Font.ALIGN.LEFT);

                }
                else
                {

                }
                 */





            }

        })
    });