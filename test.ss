
(define a (+ 1 (+ 1234 890 549))) ; define a variable
(display  7 6)   ; hello, world! this is a comment!  output 7 6
(display a) ; output 2674
(display (< 1 2 3)) ; output true
(display (< 3 1 2)) ; output false

(define a 1) ; redefine a to 1
(display 3 a) ; output 3 1

(define b true)
(display false b) ; output false true

(define c "hello")
(display c "world" "every one!") ; output hello world every one!

(display (<  1 "abc" "hello")  ; comment here
         (> "hi", "every one", 56)
         (= 1 1 a)) ; output true true true

(display b (not b) (not true)) ; output true false false

; (define sum (# (a b c) (define d (+ a b c)) d)) ; lambda expression definition
; (display (sum 1 2 3)) ; output 6

(defn (add1 n) (define n (+ n 1)) n)
(defn (add2 n) (define n (add1 n)) (define n (add1 n)) n)
(display (add2 5))

