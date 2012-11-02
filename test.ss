
(define a (+ 1 (+ 1234 890 549))) ; define a variable
(display (* 1 2 3 4)) ; output 24
(display (/ 100 2 3)); output 16.666666666666668
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

; lambda expression definition
(define sum (lambda (a b c) (define d (+ a b c)) d))
(display "lambda sum" (sum 1 2 3)) ; output lambda sum 6

(defn (add1 n) (define n (+ n 1)) n)
(defn (add2 n) (define n (add1 n)) (define n (add1 n)) n)
(display (add2 5)) ; output 7


(defn (fib n)  ; define a fibonacci func
      (if (= 1 n)
          1
          (if (= 2 n)
              1
              (+ (fib (- n 1))
                 (fib (- n 2))))))
(display (fib 7)) ; output 13

; list, and nested list, and list-len, and n-th of list
(define l1 (list "a" 1 (list 2 3) (fib 13)))
(display l1)  ; output [a,1,[2,3],233]
(display (list-len l1)) ; output 4
(display (n-th l1 3))  ; output 233

; cons, car, cdr
(define l2 (cons 2 3 (list 5 6 "abc") l1))
(display l2) ; output [2,3,5,6,abc,a,1,[2,3],233]
(display (car l2)) ; output 2
(display (cdr l2)) ; output [3,5,6,abc,a,1,[2,3],233]

; typeof
(display (typeof l2)) ; output LIST

; currying
(defn (f1 a b c) (+ a b c))
(define f2 (f1 1))
(define f3 (f2 2))
(display f2) ; output [Function(2)(2)]
(display (f3 3)) ; output 6

; more powerful +
(display (+ "a" "b" 1 true)) ; output ab1true
(display (+ true false)) ; output 1
(display (+ true))  ; output true

; cond
(define a 1)
(define b 2)
(display (cond ((> a b) b)
               ((= a b) a)
               (else a))) ; output 1

(display (cond (false "false")
                (true "true"))) ; output true